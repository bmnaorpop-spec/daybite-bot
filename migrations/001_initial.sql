-- Migration 001: Initial schema
-- Documents the baseline tables created when DayBite was first launched.
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  telegramId INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dietType TEXT NOT NULL,
  calorieGoal INTEGER,
  customDietRules TEXT,
  goal TEXT NOT NULL,
  botPersonality TEXT NOT NULL,
  customPersonality TEXT,
  currentDayLog TEXT NOT NULL DEFAULT '[]',
  lastLogDate TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegramId INTEGER NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  timeOfDay TEXT NOT NULL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  notes TEXT,
  loggedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegramId INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL
)
