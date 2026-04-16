"""Pydantic models shared across all API routers."""

from pydantic import BaseModel, field_validator
from typing import List, Dict, Optional


# ---------------------------------------------------------------------------
# Content Models
# ---------------------------------------------------------------------------

class CourseBasic(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    image: str
    color: str


class IntroSection(BaseModel):
    title: str
    content: str
    keyPoints: List[str]


class ContentSection(BaseModel):
    heading: str
    text: str


class CourseContent(BaseModel):
    title: str
    sections: List[ContentSection]


class Activity(BaseModel):
    type: str
    instruction: str
    pairs: Optional[List[Dict[str, str]]] = None
    correctOrder: Optional[List[str]] = None


class ActivitiesData(BaseModel):
    title: str
    items: List[Activity]


# ---------------------------------------------------------------------------
# Quiz Models
# ---------------------------------------------------------------------------

class QuizQuestionOut(BaseModel):
    id: int
    question: str
    options: List[str]


class QuizDataOut(BaseModel):
    title: str
    questions: List[QuizQuestionOut]


class SubmitAnswersReq(BaseModel):
    answers: Dict[int, int]


class QuestionResult(BaseModel):
    id: int
    correct_option: int
    is_correct: bool
    explanation: str


class ScoreResponse(BaseModel):
    score: int
    total: int
    percentage: int
    results: List[QuestionResult]


# ---------------------------------------------------------------------------
# Chat Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Question must not be empty.")
        return v.strip()


class SourceInfo(BaseModel):
    page_start: int
    page_end: int


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceInfo]
