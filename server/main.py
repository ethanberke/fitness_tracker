from fastapi import FastAPI
from pydantic import BaseModel
from datetime import date, datetime
import psycopg2
import os
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base

app = FastAPI()

Base = declarative_base()

# class Exercise(Base):
#     __tablename__ = "exercises"
#     id = Column(Integer, primary_key=True, index=True)
#     exercise_name: str
#     working_set_count: int
#     reps_per_set: int
#     working_weight: int
#     exercise_date: date

class CreateExercise(BaseModel):
    exercise_name: str
    working_set_count: int
    reps_per_set: int
    working_weight: int
    exercise_date: str

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

@app.get('/')
def root():
    return {"message": "Fitness Tracker API"}

@app.get("/exercises")
def get_exercises():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM exercises;")
    rows = cur.fetchall()
    
    colnames = [desc[0] for desc in cur.description]
    
    results = [
        dict(zip(colnames, row))
        for row in rows
    ]
    cur.close()
    conn.close()
    
    return results
    
@app.post("/exercises")
def add_exercises(exercise: CreateExercise):
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute(
                """
                INSERT INTO exercises (exercise_name, working_set_count, reps_per_set, working_weight, exercise_date)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *;
                """,
            (exercise.exercise_name, exercise.working_set_count, exercise.reps_per_set, exercise.working_weight, exercise.exercise_date)           
    )
    
    new_row = cur.fetchone()
    
    colnames = [desc[0] for desc in cur.description]
    
    result = [
        dict(zip(colnames, new_row))
    ]
    conn.commit()
    cur.close()
    conn.close()
    
    return result
    