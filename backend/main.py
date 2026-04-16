"""
Modular Monolith API — FastAPI entry point.

Initialises FAISS search, the Multi-LLM Orchestrator, and serves
the React frontend from ``chat-ui/dist``.
"""

import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "routers", ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from routers import content, quiz, chat

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load FAISS index, embedding model, and LLM orchestrator on startup."""
    try:
        chat.state["index"] = chat.load_faiss_index(chat.FAISS_INDEX_PATH)
        chat.state["chunks"] = chat.load_chunks(chat.CHUNKS_PATH)
        chat.state["embedder"] = chat.load_embedding_model()
        chat.state["llm"] = chat.MarineLLMOrchestrator()
        logger.info("Chat Resources loaded — Multi-LLM Orchestrator active.")
    except Exception as exc:
        logger.warning("Startup warning for Chat Service: %s", exc)
    yield
    chat.state.clear()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="Modular Monolith API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(content.router, prefix="/api/content", tags=["Content"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

# ---------------------------------------------------------------------------
# Frontend Serving
# ---------------------------------------------------------------------------

FRONTEND_DIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "chat-ui", "dist",
)


@app.get("/")
async def root():
    """Serve the React SPA index page."""
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend build not found in chat-ui/dist. Run 'npm run build'."}


@app.get("/{path:path}")
async def catch_all(path: str):
    """SPA catch-all: serve static assets or fall back to ``index.html``."""
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API Route Not Found")

    full_path = os.path.join(FRONTEND_DIST_DIR, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return FileResponse(full_path)

    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend build not found in chat-ui/dist."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
