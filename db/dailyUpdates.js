import { db } from "./database.js";

export function saveDailyUpdate({
  phone,
  type,
  time,
  location = null,
  query = null,
  lastSentDate = null,
}) {
  const stmt = db.prepare(`
    INSERT INTO daily_updates (phone, type, time, location, query, last_sent_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    phone,
    type,
    time,
    location,
    query,
    lastSentDate,
    new Date().toISOString()
  );
}

export function listDailyUpdates(phone) {
  return db.prepare(`
    SELECT * FROM daily_updates
    WHERE phone = ? AND enabled = 1
    ORDER BY time ASC, created_at DESC
  `).all(phone);
}

export function findDailyUpdatesByType(phone, type) {
  return db.prepare(`
    SELECT * FROM daily_updates
    WHERE phone = ? AND enabled = 1 AND type = ?
    ORDER BY created_at DESC
  `).all(phone, type);
}

export function getLastDailyUpdate(phone) {
  return db.prepare(`
    SELECT * FROM daily_updates
    WHERE phone = ? AND enabled = 1
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).get(phone);
}

export function getDueDailyUpdates(today, nowTime) {
  return db.prepare(`
    SELECT * FROM daily_updates
    WHERE enabled = 1
      AND time <= ?
      AND (last_sent_date IS NULL OR last_sent_date < ?)
  `).all(nowTime, today);
}

export function markDailyUpdateSent(id, today) {
  return db.prepare(`
    UPDATE daily_updates
    SET last_sent_date = ?
    WHERE id = ?
  `).run(today, id);
}

export function disableDailyUpdate(id) {
  return db.prepare(`
    UPDATE daily_updates
    SET enabled = 0
    WHERE id = ?
  `).run(id);
}

export function updateDailyUpdateById(id, fields = {}) {
  const updates = [];
  const values = [];

  if (fields.type) {
    updates.push("type = ?");
    values.push(fields.type);
  }

  if (fields.time) {
    updates.push("time = ?");
    values.push(fields.time);
  }

  if (fields.location !== undefined) {
    updates.push("location = ?");
    values.push(fields.location);
  }

  if (fields.query !== undefined) {
    updates.push("query = ?");
    values.push(fields.query);
  }

  if (updates.length === 0) return null;

  values.push(id);
  return db.prepare(`
    UPDATE daily_updates
    SET ${updates.join(", ")}
    WHERE id = ?
  `).run(...values);
}
