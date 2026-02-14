import { db } from "./database.js";

export function saveReminder({ phone, content, date, time }) {
  const normalizedDate = date.split("T")[0];
  const normalizedTime = time ?? null;
  void normalizedTime;

  const stmt = db.prepare(`
    INSERT INTO reminders (phone, content, date, created_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(phone, content, normalizedDate, new Date().toISOString());
}
