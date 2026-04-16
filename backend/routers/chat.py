import os
import json
import pickle
import logging
import asyncio

from dotenv import load_dotenv
load_dotenv()

import faiss
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sentence_transformers import SentenceTransformer
from google import genai
from groq import AsyncGroq

import models

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "routers", "embedding_output")

FAISS_INDEX_PATH = os.path.join(OUTPUT_DIR, "faiss_index.bin")
CHUNKS_PATH = os.path.join(OUTPUT_DIR, "chunks.pkl")

MODEL_NAME = "intfloat/multilingual-e5-base"
QUERY_PREFIX = "query: "
TOP_K = 3

# LLM model identifiers
GROQ_PRIMARY_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
GROQ_EXPERT_MODEL = "openai/gpt-oss-120b"
GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global State  (populated by main.py lifespan)
# ---------------------------------------------------------------------------

state: dict = {}

# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------


def load_faiss_index(path: str) -> faiss.Index:
    """Load and validate a FAISS index from disk."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"FAISS index not found: {path}")
    index = faiss.read_index(path)
    if index.ntotal == 0:
        raise ValueError("FAISS index is empty — no vectors stored.")
    logger.info("FAISS index loaded — %d vectors", index.ntotal)
    return index


def load_chunks(path: str) -> list[dict]:
    """Load pickled text chunks that correspond to the FAISS vectors."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Chunks file not found: {path}")
    with open(path, "rb") as f:
        chunks = pickle.load(f)
    if not chunks:
        raise ValueError("Chunks file is empty.")
    logger.info("Loaded %d chunks", len(chunks))
    return chunks


def load_embedding_model(model_name: str = MODEL_NAME) -> SentenceTransformer:
    """Download (if needed) and load the sentence-transformer embedding model."""
    logger.info("Loading embedding model: %s", model_name)
    model = SentenceTransformer(model_name)
    logger.info("Embedding model ready — dim: %d", model.get_sentence_embedding_dimension())
    return model


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------


def retrieve(
    query: str,
    model: SentenceTransformer,
    index: faiss.Index,
    chunks: list[dict],
    k: int = TOP_K,
) -> list[dict]:
    """Embed *query*, search the FAISS index, and return the top-k chunks."""
    prefixed = QUERY_PREFIX + query
    embedding = model.encode(
        [prefixed],
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).astype(np.float32)

    distances, indices = index.search(embedding, k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        chunk = chunks[idx]
        results.append({
            "text": chunk["text"],
            "start_page": chunk["start_page"],
            "end_page": chunk["end_page"],
            "score": float(dist),
        })
    return results


# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
أنت مساعد لوجستي بحري ذكي وخبير ميداني. مهمتك تبسيط العمليات البحرية المعقدة بأسلوب مهني وعملي.

### تعليمات الأداء والأسلوب:
1. **الشخصية المهنية:** تحدث كخبير يوجه زميله في العمل أو عميلاً في الميناء. استخدم لغة حيوية ومباشرة. ابدأ الإجابة فوراً دون مقدمات إنشائية مثل "بناءً على المعلومات المتاحة" أو "يسرني إخبارك".
2. **التنسيق البصري:** - استخدم النقاط (Bullet points) لتنظيم المعلومات.
   - استخدم الخط **العريض (Bold)** للمصطلحات البحرية واللوجستية الأساسية (مثل **Bill of Lading**، **Demurrage**).
   - اجعل الفقرات قصيرة ومركزة لسهولة القراءة على الشاشات.
3. **الرفض الذكي:** إذا سُئلت عن موضوع خارج النطاق البحري، اعتذر بلباقة موضحاً أن خبرتك تتركز حصراً في "العمليات البحرية، الملاحة، وسلاسل الإمداد".
4. **الاختصار غير المخل:** لا تكرر الكلام، واذكر الخطوات بوضوح دون حشو.

### بروتوكول الرد (صارم جداً):
5. **التعامل مع مدخلات المستخدم:**
   - **الحالة الأولى (تحية فقط):** إذا أرسل المستخدم تحية فقط (مثل: "سلام"، "صباح الخير")، رد بـ: [رد التحية المناسب] + "، أنا مساعدك البحري الذكي، أساعدك في تبسيط مفاهيم الموانئ وسلاسل الإمداد البحرية. كيف يمكنني مساعدتك اليوم؟".
   - **الحالة الثانية (سؤال تقني):** إذا سأل المستخدم سؤالاً (حتى لو بدأه بتحية)، **ادخل في الإجابة مباشرة**. يمنع تماماً ذكر الجملة التعريفية (أنا مساعدك البحري...) أو "كيف يمكنني مساعدتك" في هذه الحالة. ابدأ بالمعلومة التقنية فوراً.

### جودة المحتوى:
- اعتمد على السياق لتقديم حقائق دقيقة.
- ممنوع تماماً ذكر أرقام صفحات أو عبارات مثل "المستند يذكر".
- حول التعريفات الجافة إلى شرح وظيفي (مثلاً: اشرح أهمية المصطلح في استقرار السفينة أو حركة الميناء).\
"""


# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------


def build_prompt(question: str, context_chunks: list[dict]) -> str:
    """Combine retrieved FAISS chunks with the user question into an LLM prompt."""
    context_parts = []
    for i, chunk in enumerate(context_chunks, 1):
        page_info = (
            f"صفحة {chunk['start_page']}"
            if chunk["start_page"] == chunk["end_page"]
            else f"صفحة {chunk['start_page']}–{chunk['end_page']}"
        )
        context_parts.append(f"[مقطع {i} — {page_info}]\n{chunk['text']}")

    context_block = "\n\n".join(context_parts)

    return f"""السياق:
{context_block}

السؤال: {question}

الإجابة:"""


# ---------------------------------------------------------------------------
# Multi-LLM Orchestrator
# ---------------------------------------------------------------------------

# Keywords that signal the query needs the expert (120b) model
EXPERT_KEYWORDS_AR = {
    "قارن", "احسب", "الفرق", "حلل", "تحليل", "مقارنة",
    "كم تكلفة", "نسبة", "الفرق بين", "ما الفرق",
    "أيهما أفضل", "ميزة وعيب", "مزايا وعيوب",
}
EXPERT_KEYWORDS_EN = {
    "compare", "calculate", "difference", "analyze",
    "versus", "how much", "ratio", "pros and cons",
}


class MarineLLMOrchestrator:
    """
    Three-tier LLM orchestrator with automatic fallback.

    Priority order:
      1. **Primary**  — Groq Llama-4-Scout-17B  (fast, handles ~90 % of queries)
      2. **Expert**   — Groq GPT-OSS-120B       (deep reasoning / comparisons)
      3. **Fallback** — Google Gemini 2.5 Flash  (stability when Groq is down)
    """

    def __init__(self) -> None:
        """Initialise both Groq and Gemini API clients from environment variables."""
        # ---- Groq client -------------------------------------------------
        groq_key = os.environ.get("GROQ_API_KEY")
        if not groq_key:
            raise EnvironmentError("GROQ_API_KEY environment variable is not set.")
        self.groq = AsyncGroq(api_key=groq_key)
        logger.info(
            "Groq client ready — primary: %s | expert: %s",
            GROQ_PRIMARY_MODEL, GROQ_EXPERT_MODEL,
        )

        # ---- Gemini client ------------------------------------------------
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            raise EnvironmentError("GEMINI_API_KEY environment variable is not set.")
        self.gemini = genai.Client(api_key=gemini_key)
        logger.info("Gemini fallback client ready — model: %s", GEMINI_FALLBACK_MODEL)

    # ------------------------------------------------------------------ #
    # Query Classification
    # ------------------------------------------------------------------ #

    @staticmethod
    def classify_query(query: str) -> str:
        """
        Lightweight keyword / length heuristic.

        Returns ``"expert"`` for complex reasoning queries,
        ``"primary"`` for everything else.
        """
        q_lower = query.lower()

        for kw in EXPERT_KEYWORDS_AR | EXPERT_KEYWORDS_EN:
            if kw in q_lower:
                return "expert"

        # Long multi-part questions (>150 chars with 2+ question marks)
        if len(query) > 150 and (query.count("؟") + query.count("?")) >= 2:
            return "expert"

        return "primary"

    # ------------------------------------------------------------------ #
    # Groq Streaming
    # ------------------------------------------------------------------ #

    async def _stream_groq(self, prompt: str, model_tier: str):
        """Yield text deltas from a Groq streaming chat completion."""
        model_id = GROQ_EXPERT_MODEL if model_tier == "expert" else GROQ_PRIMARY_MODEL

        request_kwargs: dict = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "stream": True,
            "temperature": 0.4,
            "max_tokens": 2048,
        }

        if model_tier == "expert":
            request_kwargs["reasoning_effort"] = "medium"

        logger.info("Groq streaming → model: %s (tier: %s)", model_id, model_tier)
        stream = await self.groq.chat.completions.create(**request_kwargs)

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

    # ------------------------------------------------------------------ #
    # Gemini Fallback Streaming
    # ------------------------------------------------------------------ #

    async def _stream_gemini_async(self, prompt: str):
        """
        Yield text chunks from Gemini.

        ``generate_content_stream()`` is synchronous, so the actual I/O is
        offloaded to a thread pool via ``asyncio.to_thread``.
        """
        logger.info("Gemini fallback streaming → model: %s", GEMINI_FALLBACK_MODEL)

        def _sync_generate() -> list[str]:
            chunks: list[str] = []
            response_stream = self.gemini.models.generate_content_stream(
                model=GEMINI_FALLBACK_MODEL,
                contents=prompt,
                config={"system_instruction": SYSTEM_PROMPT},
            )
            for chunk in response_stream:
                if chunk.text:
                    chunks.append(chunk.text)
            return chunks

        text_chunks = await asyncio.to_thread(_sync_generate)
        for text_chunk in text_chunks:
            yield text_chunk

    # ------------------------------------------------------------------ #
    # Main Streaming Entrypoint
    # ------------------------------------------------------------------ #

    async def stream_answer(
        self,
        question: str,
        context_chunks: list[dict],
    ):
        """
        Async generator that yields NDJSON lines for ``StreamingResponse``.

        Protocol::

            {"type":"sources", "sources":[...]}   ← first
            {"type":"chunk",   "text":"..."}       ← repeated
            {"type":"done",    "model":"..."}       ← last
        """
        prompt = build_prompt(question, context_chunks)
        model_tier = self.classify_query(question)

        # 1. Emit sources
        sources = [
            {"page_start": c["start_page"], "page_end": c["end_page"]}
            for c in context_chunks
        ]
        yield json.dumps({"type": "sources", "sources": sources},
                         ensure_ascii=False) + "\n"

        # 2. Try Groq (primary or expert)
        used_model = GROQ_EXPERT_MODEL if model_tier == "expert" else GROQ_PRIMARY_MODEL
        try:
            async for text_chunk in self._stream_groq(prompt, model_tier):
                yield json.dumps({"type": "chunk", "text": text_chunk},
                                 ensure_ascii=False) + "\n"

        except Exception as groq_err:
            logger.warning(
                "Groq failed (%s: %s) — falling back to Gemini",
                type(groq_err).__name__, groq_err,
            )
            used_model = GEMINI_FALLBACK_MODEL
            try:
                async for text_chunk in self._stream_gemini_async(prompt):
                    yield json.dumps({"type": "chunk", "text": text_chunk},
                                     ensure_ascii=False) + "\n"
            except Exception as gemini_err:
                logger.error("Gemini fallback also failed: %s", gemini_err)
                yield json.dumps({
                    "type": "error",
                    "message": "جميع نماذج الذكاء الاصطناعي غير متاحة حالياً. حاول مرة أخرى لاحقاً.",
                }, ensure_ascii=False) + "\n"
                return

        # 3. Done signal
        logger.info("Stream complete — model used: %s", used_model)
        yield json.dumps({"type": "done", "model": used_model},
                         ensure_ascii=False) + "\n"

    # ------------------------------------------------------------------ #
    # Non-Streaming (legacy JSON endpoint)
    # ------------------------------------------------------------------ #

    async def generate_answer(
        self,
        question: str,
        context_chunks: list[dict],
    ) -> str:
        """Return a complete answer string (non-streaming) with Groq → Gemini fallback."""
        prompt = build_prompt(question, context_chunks)
        model_tier = self.classify_query(question)

        try:
            model_id = GROQ_EXPERT_MODEL if model_tier == "expert" else GROQ_PRIMARY_MODEL
            request_kwargs: dict = {
                "model": model_id,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.4,
                "max_tokens": 2048,
            }
            if model_tier == "expert":
                request_kwargs["reasoning_effort"] = "medium"

            logger.info("Groq non-stream → %s", model_id)
            response = await self.groq.chat.completions.create(**request_kwargs)
            return response.choices[0].message.content.strip()

        except Exception as groq_err:
            logger.warning("Groq failed (%s) — non-stream fallback to Gemini", groq_err)
            response = await self.gemini.aio.models.generate_content(
                model=GEMINI_FALLBACK_MODEL,
                contents=prompt,
                config={"system_instruction": SYSTEM_PROMPT},
            )
            return response.text.strip()


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()


@router.post("/stream")
async def chat_stream(request: models.ChatRequest):
    """Streaming chat endpoint — returns NDJSON lines via ``StreamingResponse``."""
    try:
        chunks = retrieve(
            query=request.question,
            model=state["embedder"],
            index=state["index"],
            chunks=state["chunks"],
            k=TOP_K,
        )
    except Exception as exc:
        logger.error("Retrieval failed: %s", exc)
        raise HTTPException(status_code=500, detail="Retrieval failed.") from exc

    if not chunks:
        async def empty_response():
            yield json.dumps({"type": "sources", "sources": []}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "chunk", "text": "لم يتم العثور على الإجابة في المستند"}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done", "model": "none"}, ensure_ascii=False) + "\n"

        return StreamingResponse(
            empty_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    orchestrator: MarineLLMOrchestrator = state["llm"]

    return StreamingResponse(
        orchestrator.stream_answer(question=request.question, context_chunks=chunks),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/", response_model=models.ChatResponse)
@router.post("", response_model=models.ChatResponse)
async def chat(request: models.ChatRequest):
    """Legacy JSON endpoint — returns a complete ``ChatResponse``."""
    try:
        chunks = retrieve(
            query=request.question,
            model=state["embedder"],
            index=state["index"],
            chunks=state["chunks"],
            k=TOP_K,
        )
    except Exception as exc:
        logger.error("Retrieval failed: %s", exc)
        raise HTTPException(status_code=500, detail="Retrieval failed.") from exc

    if not chunks:
        return models.ChatResponse(
            answer="لم يتم العثور على الإجابة في المستند",
            sources=[],
        )

    try:
        orchestrator: MarineLLMOrchestrator = state["llm"]
        answer = await orchestrator.generate_answer(
            question=request.question,
            context_chunks=chunks,
        )
    except Exception as exc:
        logger.error("LLM generation failed: %s", exc)
        raise HTTPException(status_code=502, detail="LLM generation failed.") from exc

    sources = [
        models.SourceInfo(page_start=c["start_page"], page_end=c["end_page"])
        for c in chunks
    ]

    return models.ChatResponse(answer=answer, sources=sources)
