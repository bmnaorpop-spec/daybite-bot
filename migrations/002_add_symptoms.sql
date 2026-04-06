-- Migration 002: Add post-meal symptom tracking
-- Adds symptom and symptomLoggedAt columns to meal_logs.
-- Running this on a DB that already has these columns will be caught by the
-- migration runner's duplicate-column guard and skipped gracefully.

ALTER TABLE meal_logs ADD COLUMN symptom TEXT;
ALTER TABLE meal_logs ADD COLUMN symptomLoggedAt TEXT
