-- Add symptoms tracking to meal logs
ALTER TABLE meal_logs ADD COLUMN symptoms TEXT DEFAULT NULL;
