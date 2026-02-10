import Database from "better-sqlite3";

export const db = new Database("tatito.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )
`).run();
