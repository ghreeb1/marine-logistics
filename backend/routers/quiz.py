import os
import json
from fastapi import APIRouter, HTTPException
import models

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "courses.json")

def load_data():
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/courses/{course_id}/quiz", response_model=models.QuizDataOut)
def get_quiz(course_id: str):
    courses = load_data()
    for c in courses:
        if c["id"] == course_id:
            quiz_data = c["quiz"]
            questions_out = []
            
            for i, q in enumerate(quiz_data["questions"]):
                questions_out.append(models.QuizQuestionOut(
                    id=i,
                    question=q["question"],
                    options=q["options"]
                ))
            
            return models.QuizDataOut(
                title=quiz_data["title"],
                questions=questions_out
            )
    raise HTTPException(status_code=404, detail="Course not found")

@router.post("/courses/{course_id}/quiz/score", response_model=models.ScoreResponse)
def get_score(course_id: str, payload: models.SubmitAnswersReq):
    courses = load_data()
    for c in courses:
        if c["id"] == course_id:
            quiz_data = c["quiz"]
            results = []
            score = 0
            total = len(quiz_data["questions"])
            for i, q in enumerate(quiz_data["questions"]):
                user_ans = payload.answers.get(i)
                is_correct = (user_ans == q["correct"])
                if is_correct:
                    score += 1
                
                results.append(models.QuestionResult(
                    id=i,
                    correct_option=q["correct"],
                    is_correct=is_correct,
                    explanation=q["explanation"]
                ))
            
            percentage = round((score / total) * 100) if total > 0 else 0
            
            return models.ScoreResponse(
                score=score,
                total=total,
                percentage=percentage,
                results=results
            )
            
    raise HTTPException(status_code=404, detail="Course not found")
