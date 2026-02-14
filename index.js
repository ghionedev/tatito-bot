import { interpretMessage } from "./services/ia.js";
import { saveReminder } from "./db/reminders.js";
import { startDailyCheck } from "./scheluder/dailyCheck.js";
import { getPending, setPending, clearPending } from "./state/pending.js";
import { mergePending } from "./state/mergePending.js";
import {
  buildConfirmationMessage,
  buildClarificationMessage,
  buildUnknownIntentMessage,
} from "./utils/messages.js";

import express from "express";
import "dotenv/config";

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Tatito Bot is running");
});

function toTwiml(message) {
  return `<Response><Message>${message}</Message></Response>`;
}

app.post("/webhook/whatsapp", async (req, res) => {
  const message = req.body.Body;
  const from = req.body.From?.replace("whatsapp:", "");

  if (!message || !from) {
    res.type("text/xml").send(toTwiml("No pude procesar ese mensaje."));
    return;
  }

  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const normalizedMessage = message.trim();
  const pending = getPending(from);
  console.log("[webhook]", { requestId, pending_loaded: Boolean(pending) });

  const interpretation = await interpretMessage(message, { pending });
  const merged = mergePending(pending, interpretation.pending_state);
  let fallbackContentApplied = false;

  if (
    pending?.intent === "reminder" &&
    pending?.date &&
    !pending?.content &&
    normalizedMessage
  ) {
    merged.content = normalizedMessage;
    fallbackContentApplied = true;
  }

  console.log("\u{1F9E0} IA result:", interpretation);
  console.log("[webhook]", {
    requestId,
    from,
    message: normalizedMessage,
    pending_before: pending,
    ia_result: interpretation,
    merged_state: merged,
  });

  if (merged?.intent === "reminder" && merged?.content && merged?.date) {
    const normalizedTime = merged.time ?? null;

    saveReminder({
      phone: from,
      content: merged.content,
      date: merged.date,
      time: normalizedTime,
    });

    console.log("\u{1F4BE} Reminder saved", {
      phone: from,
      content: merged.content,
      date: merged.date,
      time: normalizedTime,
    });

    console.log("[webhook]", {
      requestId,
      final_decision: "SAVE",
      fallback_content_applied: fallbackContentApplied,
    });

    clearPending(from);

    const confirmation = buildConfirmationMessage({
      content: merged.content,
      date: merged.date,
      time: normalizedTime,
    });

    res.type("text/xml").send(toTwiml(confirmation));
    return;
  }

  if (
    merged?.intent === "reminder" &&
    (!merged?.content || !merged?.date || interpretation.needs_clarification)
  ) {
    setPending(from, merged);

    const missingFields = [];
    if (!merged?.content) missingFields.push("content");
    if (!merged?.date) missingFields.push("date");

    const clarificationMessage = buildClarificationMessage({
      missingFields,
      date: merged?.date,
    });

    console.log("[webhook]", {
      requestId,
      final_decision: "ASK",
      fallback_content_applied: fallbackContentApplied,
    });

    res.type("text/xml").send(toTwiml(clarificationMessage));
    return;
  }

  console.log("[webhook]", { requestId, final_decision: "FALLBACK" });
  res.type("text/xml").send(toTwiml(buildUnknownIntentMessage()));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

startDailyCheck();
