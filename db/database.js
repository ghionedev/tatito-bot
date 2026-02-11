import Database from "better-sqlite3";

export const db = new Database("tatito.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    recurrence TEXT,
    sent INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )
`).run();

const reminderColumns = db.prepare("PRAGMA table_info(reminders)").all();
const columnNames = new Set(reminderColumns.map((col) => col.name));

if (!columnNames.has("time")) {
  db.prepare("ALTER TABLE reminders ADD COLUMN time TEXT").run();
}

if (!columnNames.has("recurrence")) {
  db.prepare("ALTER TABLE reminders ADD COLUMN recurrence TEXT").run();
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS daily_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    type TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT,
    query TEXT,
    enabled INTEGER DEFAULT 1,
    last_sent_date TEXT,
    created_at TEXT NOT NULL
  )
`).run();

const dailyUpdateColumns = db.prepare("PRAGMA table_info(daily_updates)").all();
const dailyColumnNames = new Set(dailyUpdateColumns.map((col) => col.name));

if (!dailyColumnNames.has("enabled")) {
  db.prepare("ALTER TABLE daily_updates ADD COLUMN enabled INTEGER DEFAULT 1").run();
}

if (!dailyColumnNames.has("last_sent_date")) {
  db.prepare("ALTER TABLE daily_updates ADD COLUMN last_sent_date TEXT").run();
}
