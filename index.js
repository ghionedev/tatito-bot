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

function extractReminderContentFromMessage(message) {
  const reminderCommandPattern =
    /\b(haceme\s+acordar(?:me)?|acordame|recordame|recorda(?:me)?|acordar)\b/i;

  if (!reminderCommandPattern.test(message)) {
    return null;
  }

  let candidate = message.toLowerCase();

  candidate = candidate.replace(
    /\b(haceme\s+acordar(?:me)?|acordame|recordame|recorda(?:me)?|acordar)\b/gi,
    " "
  );
  candidate = candidate.replace(/\bde\b/gi, " ");
  candidate = candidate.replace(
    /\b(el|este|proximo|próximo)\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
    " "
  );
  candidate = candidate.replace(
    /\b(pasado\s+mañana|pasado\s+manana|hoy|mañana|manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
    " "
  );
  candidate = candidate.replace(
    /\s+a\s+las?\s+\d{1,2}(?::\d{2})?\s*(hs?|h|am|pm)?\s*$/i,
    " "
  );
  candidate = candidate.replace(/\s+\d{1,2}(?::\d{2})?\s*(hs?|h|am|pm)\s*$/i, " ");
  candidate = candidate.replace(/[.,;:!?]+/g, " ");
  candidate = candidate.replace(/\s+/g, " ").trim();

  const lettersOnly = candidate.replace(/[^a-záéíóúüñ]/gi, "");
  if (lettersOnly.length < 3) {
    return null;
  }

  return candidate;
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
  let needsClarification = Boolean(interpretation.needs_clarification);
  const missingFields = new Set(
    Array.isArray(interpretation.missing_fields)
      ? interpretation.missing_fields
      : []
  );
  let fallbackContentApplied = false;
  let fallbackContentValue = null;

  if (
    pending?.intent === "reminder" &&
    pending?.date &&
    !pending?.content &&
    normalizedMessage
  ) {
    merged.content = normalizedMessage;
    fallbackContentApplied = true;
    fallbackContentValue = normalizedMessage;
  }

  if (
    interpretation.intent === "reminder" &&
    needsClarification &&
    missingFields.has("content") &&
    !merged?.content
  ) {
    const extractedContent = extractReminderContentFromMessage(normalizedMessage);

    if (extractedContent) {
      merged.content = extractedContent;
      missingFields.delete("content");
      fallbackContentApplied = true;
      fallbackContentValue = extractedContent;

      if (missingFields.size === 0 && merged?.date) {
        needsClarification = false;
      }
    }
  }

  console.log("\u{1F9E0} IA result:", interpretation);
  console.log("[webhook]", {
    requestId,
    from,
    message: normalizedMessage,
    pending_before: pending,
    ia_result: interpretation,
    merged_state: merged,
    fallback_content_applied: fallbackContentApplied,
    fallback_content_value: fallbackContentValue,
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
    (!merged?.content || !merged?.date || needsClarification)
  ) {
    setPending(from, merged);

    const unresolvedMissingFields = [];
    if (!merged?.content) unresolvedMissingFields.push("content");
    if (!merged?.date) unresolvedMissingFields.push("date");

    const clarificationMessage = buildClarificationMessage({
      missingFields: unresolvedMissingFields,
      date: merged?.date,
    });

    console.log("[webhook]", {
      requestId,
      final_decision: "ASK",
      fallback_content_applied: fallbackContentApplied,
      fallback_content_value: fallbackContentValue,
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
