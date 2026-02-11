import cron from "node-cron";
import { db } from "../db/database.js";
import { getLocalDateString, getLocalTimeString } from "../utils/date.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";
import { getDueDailyUpdates, markDailyUpdateSent } from "../db/dailyUpdates.js";
import { buildDailyUpdateMessage } from "../services/dailyUpdates.js";

function buildDailyMessage(reminders) {
  let message = "☀️ Buen dia\nHoy tenes:\n";

  reminders.forEach((r) => {
    message += `• ${r.content}\n`;
  });

  return message;
}

export function startDailyCheck() {
  if (process.env.CRON_ENABLED !== "true") {
    console.log("[cron] disabled (safe mode)");
    return;
  }

  // Time-based reminders (one-off and daily)
  cron.schedule("* * * * *", async () => {
    const today = getLocalDateString();
    const nowTime = getLocalTimeString();

    const dailyReminders = db.prepare(`
      SELECT * FROM reminders
      WHERE recurrence = 'daily' AND sent = 0 AND time IS NOT NULL
    `).all();

    for (const reminder of dailyReminders) {
      if (reminder.date < today) {
        db.prepare(`
          UPDATE reminders
          SET date = ?
          WHERE id = ?
        `).run(today, reminder.id);
        reminder.date = today;
      }

      if (reminder.date === today && reminder.time <= nowTime) {
        await sendWhatsAppMessage(reminder.phone, `⏰ Recordatorio: ${reminder.content}`);
        const nextDate = addDays(today, 1);
        db.prepare(`
          UPDATE reminders
          SET date = ?
          WHERE id = ?
        `).run(nextDate, reminder.id);
      }
    }

    const oneOffReminders = db.prepare(`
      SELECT * FROM reminders
      WHERE date = ? AND sent = 0 AND time IS NOT NULL AND (recurrence IS NULL OR recurrence = '')
    `).all(today);

    const dueOneOff = oneOffReminders.filter((r) => r.time <= nowTime);
    if (dueOneOff.length === 0) return;

    for (const reminder of dueOneOff) {
      await sendWhatsAppMessage(reminder.phone, `⏰ Recordatorio: ${reminder.content}`);
      db.prepare(`
        UPDATE reminders
        SET sent = 1
        WHERE id = ?
      `).run(reminder.id);
    }

    const dailyUpdates = getDueDailyUpdates(today, nowTime);
    for (const update of dailyUpdates) {
      try {
        const message = await buildDailyUpdateMessage(update);
        await sendWhatsAppMessage(update.phone, message);
        markDailyUpdateSent(update.id, today);
      } catch {
        // ignore to avoid breaking scheduler loop
      }
    }
  });

  // Daily summary for reminders without time
  cron.schedule("0 9 * * *", () => {
    const today = getLocalDateString();

    const reminders = db.prepare(`
      SELECT * FROM reminders
      WHERE date = ? AND sent = 0 AND time IS NULL AND (recurrence IS NULL OR recurrence = '')
    `).all(today);

    if (reminders.length === 0) return;

    const remindersByPhone = new Map();
    for (const reminder of reminders) {
      if (!remindersByPhone.has(reminder.phone)) {
        remindersByPhone.set(reminder.phone, []);
      }
      remindersByPhone.get(reminder.phone).push(reminder);
    }

    for (const [phone, list] of remindersByPhone.entries()) {
      const message = buildDailyMessage(list);
      sendWhatsAppMessage(phone, message);
    }

    db.prepare(`
      UPDATE reminders
      SET sent = 1
      WHERE date = ? AND time IS NULL AND (recurrence IS NULL OR recurrence = '')
    `).run(today);
  });

  console.log("[cron] scheduler started (every minute + 09:00 summary)");
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
