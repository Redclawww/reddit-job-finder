import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { migrations } from "./migrations";

export function createDatabase(databasePath: string) {
  const dir = path.dirname(databasePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(databasePath);

  db.pragma("journal_mode = WAL");

  for (const migration of migrations) {
    db.exec(migration);
  }

  return db;
}

export type AppDatabase = ReturnType<typeof createDatabase>;
