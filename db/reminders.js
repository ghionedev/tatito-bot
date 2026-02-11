import { db } from "./database.js";

export function saveReminder({ phone, content, date, time = null, recurrence = null }) {
  const normalizedDate = normalizeDate(date);

  const stmt = db.prepare(`
    INSERT INTO reminders (phone, content, date, time, recurrence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    phone,
    content,
    normalizedDate,
    time,
    recurrence,
    new Date().toISOString()
  );
}

export function listReminders(phone) {
  return db.prepare(`
    SELECT *
    FROM reminders
    WHERE phone = ? AND sent = 0
    ORDER BY date ASC, time ASC, created_at DESC
  `).all(phone);
}

export function findRemindersByContent(phone, query) {
  return db.prepare(`
    SELECT *
    FROM reminders
    WHERE phone = ? AND content LIKE ? AND sent = 0
    ORDER BY created_at DESC
  `).all(phone, `%${query}%`);
}

export function getLastReminder(phone) {
  return db.prepare(`
    SELECT *
    FROM reminders
    WHERE phone = ? AND sent = 0
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).get(phone);
}

export function deleteReminderById(id) {
  return db.prepare(`
    DELETE FROM reminders
    WHERE id = ?
  `).run(id);
}

export function updateReminderById(id, fields = {}) {
  const updates = [];
  const values = [];

  if (fields.content) {
    updates.push("content = ?");
    values.push(fields.content);
  }

  if (fields.date) {
    updates.push("date = ?");
    values.push(normalizeDate(fields.date));
  }

  if (fields.time !== undefined) {
    updates.push("time = ?");
    values.push(fields.time);
  }

  if (fields.recurrence !== undefined) {
    updates.push("recurrence = ?");
    values.push(fields.recurrence);
  }

  if (updates.length === 0) return null;

  values.push(id);
  return db.prepare(`
    UPDATE reminders
    SET ${updates.join(", ")}
    WHERE id = ?
  `).run(...values);
}

export function markReminderSent(id) {
  return db.prepare(`
    UPDATE reminders
    SET sent = 1
    WHERE id = ?
  `).run(id);
}

export function updateReminderDate(id, nextDate) {
  const normalizedDate = normalizeDate(nextDate);
  return db.prepare(`
    UPDATE reminders
    SET date = ?
    WHERE id = ?
  `).run(normalizedDate, id);
}

function normalizeDate(value) {
  if (!value) return value;
  return value.includes("T") ? value.split("T")[0] : value;
}
