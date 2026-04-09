-- Drop existing tables if they exist
-- db titled fitness_tracker
DROP TABLE IF EXISTS exercises;

-- Create exercises table
CREATE TABLE exercises (
  id SERIAL PRIMARY KEY,
  exercise_name TEXT NOT NULL,
  working_set_count INT NOT NULL,
  reps_per_set INT NOT NULL,
  working_weight INT NOT NULL,
  exercise_date DATE NOT NULL
);

-- Insert into exercises table
INSERT INTO exercises (exercise_name, working_set_count, reps_per_set, working_weight, exercise_date)
VALUES 
  ('Abductor', 2, 8, 170, '2026-04-01'),
  ('Squats', 2, 6, 185, '2026-04-02'),
  ('Bench Press', 3, 8, 115, '2026-04-03');
