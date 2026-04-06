import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const migrationsDir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.warn("⚠️ migrations/ directory not found — skipping migrations.");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.replace(".sql", "");
    const already = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(version);

    if (already) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

    try {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
      ).run(version, new Date().toISOString());
      console.log(`✅ Migration applied: ${file}`);
    } catch (err: any) {
      // Tolerate "duplicate column name" errors so re-runs are safe
      if (err?.message?.includes("duplicate column name")) {
        db.prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
        ).run(version, new Date().toISOString());
        console.log(`⚠️  Migration ${file}: column already exists — marked as applied.`);
      } else {
        console.error(`❌ Migration failed: ${file}`, err);
        throw err;
      }
    }
  }
}
