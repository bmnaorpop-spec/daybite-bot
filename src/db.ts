import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { UserProfile, MealEntry, Message } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "daybite.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Migrate existing DB if needed
try {
  db.exec(`ALTER TABLE users ADD COLUMN customPersonality TEXT`);
} catch (_) { /* column already exists */ }

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegramId INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    dietType TEXT NOT NULL,
    calorieGoal INTEGER,
    customDietRules TEXT,
    goal TEXT NOT NULL,
    customPersonality TEXT,
    botPersonality TEXT NOT NULL,
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
  );
`);

export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function getUser(telegramId: number): UserProfile | null {
  const stmt = db.prepare("SELECT * FROM users WHERE telegramId = ?");
  const row = stmt.get(telegramId) as any;

  if (!row) return null;

  const today = getToday();
  let currentDayLog: MealEntry[] = JSON.parse(row.currentDayLog || "[]");

  // Auto-reset if new day
  if (row.lastLogDate !== today) {
    db.prepare(
      "UPDATE users SET currentDayLog = '[]', lastLogDate = ? WHERE telegramId = ?"
    ).run(today, telegramId);
    currentDayLog = [];
  }

  const history = getConversationHistory(telegramId);

  return {
    telegramId: row.telegramId as number,
    name: row.name as string,
    dietType: row.dietType as any,
    calorieGoal: row.calorieGoal != null ? (row.calorieGoal as number) : undefined,
    customDietRules: row.customDietRules != null ? (row.customDietRules as string) : undefined,
    goal: row.goal as any,
    botPersonality: row.botPersonality as any,
    customPersonality: row.customPersonality != null ? (row.customPersonality as string) : undefined,
    currentDayLog,
    lastLogDate: row.lastLogDate !== today ? today : (row.lastLogDate as string),
    conversationHistory: history,
    createdAt: row.createdAt as string,
  };
}

export function createUser(profile: Omit<UserProfile, "conversationHistory">): void {
  db.prepare(`
    INSERT INTO users (telegramId, name, dietType, calorieGoal, customDietRules, goal, botPersonality, customPersonality, currentDayLog, lastLogDate, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    profile.telegramId,
    profile.name,
    profile.dietType,
    profile.calorieGoal ?? null,
    profile.customDietRules ?? null,
    profile.goal,
    profile.botPersonality,
    profile.customPersonality ?? null,
    JSON.stringify(profile.currentDayLog),
    profile.lastLogDate,
    profile.createdAt
  );
}

export function updateUser(
  telegramId: number,
  updates: Partial<Omit<UserProfile, "telegramId" | "conversationHistory">> & { customDietRules?: string | null; calorieGoal?: number | null; customPersonality?: string | null }
): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.dietType !== undefined) {
    fields.push("dietType = ?");
    values.push(updates.dietType);
  }
  if ("calorieGoal" in updates) {
    fields.push("calorieGoal = ?");
    values.push(updates.calorieGoal ?? null);
  }
  if ("customDietRules" in updates) {
    fields.push("customDietRules = ?");
    values.push(updates.customDietRules ?? null);
  }
  if (updates.goal !== undefined) {
    fields.push("goal = ?");
    values.push(updates.goal);
  }
  if (updates.botPersonality !== undefined) {
    fields.push("botPersonality = ?");
    values.push(updates.botPersonality);
  }
  if ("customPersonality" in updates) {
    fields.push("customPersonality = ?");
    values.push(updates.customPersonality ?? null);
  }
  if (updates.currentDayLog !== undefined) {
    fields.push("currentDayLog = ?");
    values.push(JSON.stringify(updates.currentDayLog));
  }
  if (updates.lastLogDate !== undefined) {
    fields.push("lastLogDate = ?");
    values.push(updates.lastLogDate);
  }

  if (fields.length === 0) return;

  values.push(telegramId);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE telegramId = ?`).run(...values);
}

export function appendMealLog(telegramId: number, entry: MealEntry): void {
  const today = getToday();

  db.prepare(`
    INSERT INTO meal_logs (telegramId, date, description, timeOfDay, calories, protein_g, carbs_g, fat_g, notes, loggedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    telegramId,
    today,
    entry.description,
    entry.timeOfDay,
    entry.calories,
    entry.protein_g,
    entry.carbs_g,
    entry.fat_g,
    entry.notes ?? null,
    entry.loggedAt
  );

  const row = db.prepare("SELECT currentDayLog FROM users WHERE telegramId = ?").get(telegramId) as any;
  if (row) {
    const log: MealEntry[] = JSON.parse(row.currentDayLog || "[]");
    log.push(entry);
    db.prepare("UPDATE users SET currentDayLog = ?, lastLogDate = ? WHERE telegramId = ?").run(
      JSON.stringify(log),
      today,
      telegramId
    );
  }
}

export function getMealLogsForDay(telegramId: number, date: string): MealEntry[] {
  const rows = db
    .prepare("SELECT * FROM meal_logs WHERE telegramId = ? AND date = ? ORDER BY loggedAt ASC")
    .all(telegramId, date) as any[];

  return rows.map((r) => ({
    description: r.description as string,
    timeOfDay: r.timeOfDay as any,
    calories: r.calories as number,
    protein_g: r.protein_g as number,
    carbs_g: r.carbs_g as number,
    fat_g: r.fat_g as number,
    notes: r.notes != null ? (r.notes as string) : undefined,
    loggedAt: r.loggedAt as string,
  }));
}

export function getConversationHistory(telegramId: number): Message[] {
  const rows = db
    .prepare(
      "SELECT role, content FROM conversation_history WHERE telegramId = ? ORDER BY id ASC LIMIT 10"
    )
    .all(telegramId) as any[];

  return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
}

export function appendConversationMessage(
  telegramId: number,
  role: "user" | "assistant",
  content: string
): void {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO conversation_history (telegramId, role, content, createdAt) VALUES (?, ?, ?, ?)"
  ).run(telegramId, role, content, now);

  // Keep only last 10 messages
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM conversation_history WHERE telegramId = ?")
    .get(telegramId) as any;
  const count = row.cnt as number;

  if (count > 10) {
    db.prepare(`
      DELETE FROM conversation_history
      WHERE telegramId = ? AND id IN (
        SELECT id FROM conversation_history WHERE telegramId = ? ORDER BY id ASC LIMIT ?
      )
    `).run(telegramId, telegramId, count - 10);
  }
}

export function resetDayLog(telegramId: number): void {
  const today = getToday();
  db.prepare(
    "UPDATE users SET currentDayLog = '[]', lastLogDate = ? WHERE telegramId = ?"
  ).run(today, telegramId);
  db.prepare("DELETE FROM meal_logs WHERE telegramId = ? AND date = ?").run(telegramId, today);
}

export function closeDb(): void {
  db.close();
}
