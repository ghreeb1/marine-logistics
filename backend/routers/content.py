import os
import json
from fastapi import APIRouter, HTTPException
from typing import List
import models

router = APIRouter()

# Get the path to courses.json correctly relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "courses_cleaned.json")

def load_data():
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/courses", response_model=List[models.CourseBasic])
def get_courses():
    courses = load_data()
    return [
        models.CourseBasic(
            id=c["id"],
            title=c["title"],
            description=c["description"],
            icon=c["icon"],
            image=c["image"],
            color=c["color"]
        )
        for c in courses
    ]

@router.get("/courses/{course_id}/intro", response_model=models.IntroSection)
def get_intro(course_id: str):
    courses = load_data()
    for c in courses:
        if c["id"] == course_id:
            return models.IntroSection(**c["introduction"])
    raise HTTPException(status_code=404, detail="Course not found")

@router.get("/courses/{course_id}/content", response_model=models.CourseContent)
def get_content(course_id: str):
    courses = load_data()
    for c in courses:
        if c["id"] == course_id:
            return models.CourseContent(**c["content"])
    raise HTTPException(status_code=404, detail="Course not found")

@router.get("/courses/{course_id}/activities", response_model=models.ActivitiesData)
def get_activities(course_id: str):
    courses = load_data()
    for c in courses:
        if c["id"] == course_id:
            return models.ActivitiesData(**c["activities"])
    raise HTTPException(status_code=404, detail="Course not found")
