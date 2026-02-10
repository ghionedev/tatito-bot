import cron from "node-cron";
import { db } from "../db/database.js";
import { getLocalDateString } from "../utils/date.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

function buildDailyMessage(reminders) {
  let message = "Buen día ☀️\nHoy tenés:\n";

  reminders.forEach((r) => {
    message += `• ${r.content}\n`;
  });

  return message;
}

export function startDailyCheck() {
  cron.schedule("* * * * *", () => {
    const today = getLocalDateString();

    const reminders = db.prepare(`
      SELECT * FROM reminders
      WHERE date = ? AND sent = 0
    `).all(today);

    if (reminders.length === 0) return;

    const message = buildDailyMessage(reminders);
    sendWhatsAppMessage(reminders[0].phone, message);

    db.prepare(`
      UPDATE reminders
      SET sent = 1
      WHERE date = ?
    `).run(today);
  });

  console.log("🕘 Daily scheduler started (09:00 local time)");
}
