import express from "express";
import "dotenv/config";

import { interpretMessage } from "./services/ia.js";
import {
  deleteReminderById,
  findRemindersByContent,
  getLastReminder,
  listReminders,
  saveReminder,
  updateReminderById,
} from "./db/reminders.js";
import {
  findDailyUpdatesByType,
  getLastDailyUpdate,
  saveDailyUpdate,
  updateDailyUpdateById,
} from "./db/dailyUpdates.js";
import { startDailyCheck } from "./scheluder/dailyCheck.js";
import { getLocalDateString, getLocalTimeString } from "./utils/date.js";
import { getPending, setPending, clearPending } from "./state/pending.js";
import { mergePending } from "./state/mergePending.js";
import { hasSeenIntro, markSeenIntro } from "./state/users.js";
import {
  buildConfirmationMessage,
  buildDailyUpdateConfirmation,
  buildDailyUpdateChangePrompt,
  buildDailyUpdateUpdatedMessage,
  buildDeleteConfirmation,
  buildDeleteSelectionPrompt,
  buildGoodbyeMessage,
  buildGreetingMessage,
  buildHelpMessage,
  buildListRemindersMessage,
  buildMissingContentQuestion,
  buildMissingLocationQuestion,
  buildMissingTimeQuestion,
  buildMissingUpdateTypeQuestion,
  buildReminderUpdatePrompt,
  buildReminderUpdatedMessage,
  buildThanksMessage,
  buildGenericClarification,
} from "./utils/messages.js";

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Tatito Bot is running");
});

app.post("/webhook/whatsapp", async (req, res) => {
  const message = req.body.Body?.trim();
  const from = req.body.From?.replace("whatsapp:", "");

  if (!from || !message) {
    console.warn("[webhook] missing from/body", {
      from: req.body.From,
      hasBody: Boolean(req.body.Body),
    });
    return sendTwiml(res, "No pude leer tu mensaje 😅 Lo repetis?");
  }

  const pending = getPending(from);
  const isFirstTime = !hasSeenIntro(from);
  if (isFirstTime) {
    markSeenIntro(from);
  }

  const simpleIntent = detectSimpleIntent(message);
  if (simpleIntent === "greeting") {
    return sendTwiml(res, buildGreetingMessage(isFirstTime));
  }
  if (simpleIntent === "thanks") {
    clearPending(from);
    return sendTwiml(res, buildThanksMessage());
  }
  if (simpleIntent === "goodbye") {
    clearPending(from);
    return sendTwiml(res, buildGoodbyeMessage());
  }
  if (simpleIntent === "help") {
    return sendTwiml(res, buildHelpMessage());
  }

  try {
    if (pending?.kind === "delete_select") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No elimine ningun recordatorio.");
      }

      const selection = parseSelection(message, pending.candidates.length);
      if (!selection) {
        return sendTwiml(res, pending.prompt ?? "Decime el numero del recordatorio.");
      }

      const target = pending.candidates[selection - 1];
      deleteReminderById(target.id);
      clearPending(from);
      return sendTwiml(res, buildDeleteConfirmation(target));
    }

    if (pending?.kind === "delete_query") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }

      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No elimine ningun recordatorio.");
      }

      clearPending(from);
      return handleDeleteByQuery({ from, query: message, res });
    }

    if (pending?.kind === "modify_reminder_target") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No modifique ningun recordatorio.");
      }

      const target = resolveReminderTargetFromMessage(from, message);
      if (!target) {
        return sendTwiml(res, "No encontre ese recordatorio. Podes decir por ejemplo: el ultimo o el del medico.");
      }

      if (Array.isArray(target)) {
        const prompt = buildDeleteSelectionPrompt(target);
        setPending(from, { kind: "modify_reminder_select", candidates: target, prompt });
        return sendTwiml(res, prompt);
      }

      setPending(from, { kind: "modify_reminder", reminder: target, attempts: 0 });
      return sendTwiml(res, buildReminderUpdatePrompt());
    }

    if (pending?.kind === "modify_daily_target") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No modifique el informe diario.");
      }

      const target = resolveDailyUpdateTargetFromMessage(from, message);
      if (!target) {
        return sendTwiml(res, "No encontre ese informe. Podes decir: el de clima, el de noticias o el ultimo.");
      }

      if (Array.isArray(target)) {
        const prompt = buildDeleteSelectionPrompt(target);
        setPending(from, { kind: "modify_daily_select", candidates: target, prompt });
        return sendTwiml(res, prompt);
      }

      setPending(from, { kind: "modify_daily", update: target, attempts: 0 });
      return sendTwiml(res, buildDailyUpdateChangePrompt());
    }

    if (pending?.kind === "modify_reminder_select") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No modifique ningun recordatorio.");
      }

      const selection = parseSelection(message, pending.candidates.length);
      if (!selection) {
        return sendTwiml(res, pending.prompt ?? "Decime el numero del recordatorio.");
      }

      const target = pending.candidates[selection - 1];
      setPending(from, { kind: "modify_reminder", reminder: target, attempts: 0 });
      return sendTwiml(res, buildReminderUpdatePrompt());
    }

    if (pending?.kind === "modify_reminder") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No modifique ningun recordatorio.");
      }

      const parsed = await interpretMessage(message, { pending: pending.reminder });
      const updates = extractReminderUpdates(parsed);
      applyReminderTimeHeuristic(updates, message);

      if (Object.keys(updates).length === 0) {
        const attempts = (pending.attempts ?? 0) + 1;
        setPending(from, { ...pending, attempts });
        return sendTwiml(res, buildReminderUpdatePrompt());
      }

      updateReminderById(pending.reminder.id, updates);
      clearPending(from);
      return sendTwiml(res, buildReminderUpdatedMessage({
        ...pending.reminder,
        ...updates,
      }));
    }

    if (pending?.kind === "modify_daily_select") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No modifique el informe diario.");
      }

      const selection = parseSelection(message, pending.candidates.length);
      if (!selection) {
        return sendTwiml(res, pending.prompt ?? "Decime el numero del informe.");
      }

      const target = pending.candidates[selection - 1];
      setPending(from, { kind: "modify_daily", update: target, attempts: 0 });
      return sendTwiml(res, buildDailyUpdateChangePrompt());
    }

    if (pending?.kind === "modify_daily") {
      if (isExitMessage(message)) {
        clearPending(from);
        return sendTwiml(res, buildExitResponse(message));
      }
      if (isCancelMessage(message)) {
        clearPending(from);
        return sendTwiml(res, "Listo 👍 No modifique el informe diario.");
      }

      const parsed = await interpretMessage(message, { pending: pending.update });
      const updates = extractDailyUpdateUpdates(parsed);
      applyDailyUpdateHeuristics(updates, message);
      normalizeDailyUpdateType(updates);

      if (Object.keys(updates).length === 0) {
        const attempts = (pending.attempts ?? 0) + 1;
        setPending(from, { ...pending, attempts });
        return sendTwiml(res, buildDailyUpdateChangePrompt());
      }

      updateDailyUpdateById(pending.update.id, updates);
      clearPending(from);
      return sendTwiml(res, buildDailyUpdateUpdatedMessage({
        ...pending.update,
        ...updates,
        update_type: updates.update_type ?? pending.update.type,
      }));
    }

    const llmPending = pending && !pending.kind ? pending : undefined;
    const interpretation = await interpretMessage(message, { pending: llmPending });
    console.log("[ia] interpretation", {
      from,
      intent: interpretation.intent,
      needs_clarification: interpretation.needs_clarification,
      missing_fields: interpretation.missing_fields,
    });

    if (interpretation.needs_clarification) {
      if (interpretation.intent === "delete_reminder") {
        if ((interpretation.missing_fields ?? []).includes("delete_query")) {
          setPending(from, { kind: "delete_query" });
        }

        const question = buildGenericClarification(
          interpretation.clarification_question ?? "Cual recordatorio queres eliminar?"
        );
        return sendTwiml(res, question);
      }

      if (interpretation.intent === "daily_update") {
        const base = llmPending ?? {};
        const incoming = interpretation.pending_state ?? {
          intent: interpretation.intent,
          update_type: interpretation.update_type,
          time: interpretation.time,
          location: interpretation.location,
          query: interpretation.query,
        };

        const merged = mergePending(base, incoming);
        applyDailyUpdateHeuristics(merged, message);
        normalizeDailyUpdateType(merged);
        if (!merged.location && process.env.DEFAULT_LOCATION) {
          merged.location = process.env.DEFAULT_LOCATION;
        }
        const missing = getDailyUpdateMissing(merged);

        if (missing.length === 0) {
          saveDailyUpdate({
            phone: from,
            type: merged.update_type,
            time: merged.time,
            location: merged.location,
            query: merged.query,
            lastSentDate: merged.time <= getLocalTimeString() ? getLocalDateString() : null,
          });
          clearPending(from);
          return sendTwiml(res, buildDailyUpdateConfirmation(merged));
        }

        const attempts = (base.attempts ?? 0) + 1;
        setPending(from, { ...merged, attempts });

        let question = buildGenericClarification(interpretation.clarification_question);
        if (missing.includes("update_type")) {
          question = buildMissingUpdateTypeQuestion();
        } else if (missing.includes("location")) {
          question = buildMissingLocationQuestion(attempts);
        } else if (missing.includes("time")) {
          question = buildMissingTimeQuestion(false);
        }

        console.log("[pending] saved", {
          from,
          pending: { ...merged, attempts },
        });

        return sendTwiml(res, question);
      }

      const base = llmPending ?? {};
      const incoming = interpretation.pending_state ?? {
        intent: interpretation.intent,
        content: interpretation.content,
        date: interpretation.date,
        time: interpretation.time,
        recurrence: interpretation.recurrence,
      };

      const merged = mergePending(base, incoming);
      applyReminderDateHeuristic(merged, message);
      applyReminderTimeHeuristic(merged, message);
      const { missing, isDaily } = getReminderMissing(merged);

      if (missing.length === 0 && merged.intent === "reminder") {
        const dateForSave = isDaily
          ? getNextDailyDate(merged.time)
          : merged.date;

        saveReminder({
          phone: from,
          content: merged.content,
          date: dateForSave,
          time: merged.time,
          recurrence: isDaily ? "daily" : null,
        });

        clearPending(from);
        return sendTwiml(res, buildConfirmationMessage({
          ...merged,
          date: dateForSave,
        }));
      }

      setPending(from, merged);

      let question = buildGenericClarification(interpretation.clarification_question);
      if (missing.includes("content")) {
        question = buildMissingContentQuestion(merged.date);
      } else if (missing.includes("time")) {
        question = buildMissingTimeQuestion(isDaily);
      } else if (missing.includes("date")) {
        question = "Para que dia queres que te lo recuerde?";
      }

      console.log("[pending] saved", {
        from,
        pending: merged,
      });

      return sendTwiml(res, question);
    }

    if (interpretation.intent === "reminder") {
      const reminder = mergePending(llmPending ?? {}, interpretation.pending_state ?? {
        intent: interpretation.intent,
        content: interpretation.content,
        date: interpretation.date,
        time: interpretation.time,
        recurrence: interpretation.recurrence,
      });
      applyReminderTimeHeuristic(reminder, message);

      const { missing, isDaily } = getReminderMissing(reminder);

      if (missing.length > 0) {
        setPending(from, reminder);

        let fallbackQuestion = "Para que dia queres que te lo recuerde?";
        if (missing.includes("content")) {
          fallbackQuestion = buildMissingContentQuestion(reminder.date);
        } else if (missing.includes("time")) {
          fallbackQuestion = buildMissingTimeQuestion(isDaily);
        }

        console.log("[reminder] incomplete reminder, asking clarification", {
          from,
          missing,
          pending: reminder,
        });

        return sendTwiml(res, fallbackQuestion);
      }

      const dateForSave = isDaily
        ? getNextDailyDate(reminder.time)
        : reminder.date;

      saveReminder({
        phone: from,
        content: reminder.content,
        date: dateForSave,
        time: reminder.time,
        recurrence: isDaily ? "daily" : null,
      });

      clearPending(from);

      console.log("[reminder] saved", {
        from,
        date: dateForSave,
      });

      return sendTwiml(res, buildConfirmationMessage({
        ...reminder,
        date: dateForSave,
      }));
    }

    if (interpretation.intent === "daily_update") {
      const update = mergePending(llmPending ?? {}, interpretation.pending_state ?? {
        intent: interpretation.intent,
        update_type: interpretation.update_type,
        time: interpretation.time,
        location: interpretation.location,
        query: interpretation.query,
      });

      applyDailyUpdateHeuristics(update, message);
      normalizeDailyUpdateType(update);
      if (!update.location && process.env.DEFAULT_LOCATION) {
        update.location = process.env.DEFAULT_LOCATION;
      }

      if (!update.query && update.update_type === "news") {
        update.query = "inteligencia artificial";
      }

      const missing = getDailyUpdateMissing(update);

      if (missing.length > 0) {
        setPending(from, { ...update, attempts: (llmPending?.attempts ?? 0) + 1 });
        let question = buildGenericClarification(interpretation.clarification_question);

        if (missing.includes("update_type")) {
          question = buildMissingUpdateTypeQuestion();
        } else if (missing.includes("location")) {
          question = buildMissingLocationQuestion((llmPending?.attempts ?? 0) + 1);
        } else if (missing.includes("time")) {
          question = buildMissingTimeQuestion(false);
        }

        return sendTwiml(res, question);
      }

      saveDailyUpdate({
        phone: from,
        type: update.update_type,
        time: update.time,
        location: update.location,
        query: update.query,
        lastSentDate: update.time <= getLocalTimeString() ? getLocalDateString() : null,
      });

      clearPending(from);
      return sendTwiml(res, buildDailyUpdateConfirmation(update));
    }

    if (interpretation.intent === "update_reminder") {
      const mode = interpretation.update_mode;
      const query = interpretation.update_query;
      const updates = extractReminderUpdates(interpretation);
      applyReminderTimeHeuristic(updates, message);

      if (!mode) {
        setPending(from, { kind: "modify_reminder_target" });
        return sendTwiml(res, "Cual recordatorio queres modificar?");
      }

      const target = resolveReminderTarget(from, mode, query);
      if (!target) {
        return sendTwiml(res, "No encontre recordatorios para modificar.");
      }

      if (Array.isArray(target)) {
        const prompt = buildDeleteSelectionPrompt(target);
        setPending(from, { kind: "modify_reminder_select", candidates: target, prompt });
        return sendTwiml(res, prompt);
      }

      if (Object.keys(updates).length === 0) {
        setPending(from, { kind: "modify_reminder", reminder: target, attempts: 0 });
        return sendTwiml(res, buildReminderUpdatePrompt());
      }

      updateReminderById(target.id, updates);
      return sendTwiml(res, buildReminderUpdatedMessage({ ...target, ...updates }));
    }

    if (interpretation.intent === "update_daily_update") {
      const mode = interpretation.update_mode;
      const query = interpretation.update_query;
      const updates = extractDailyUpdateUpdates(interpretation);
      applyDailyUpdateHeuristics(updates, message);
      normalizeDailyUpdateType(updates);

      if (!mode) {
        setPending(from, { kind: "modify_daily_target" });
        return sendTwiml(res, "Cual informe diario queres modificar?");
      }

      const target = resolveDailyUpdateTarget(from, mode, query);
      if (!target) {
        return sendTwiml(res, "No encontre informes diarios para modificar.");
      }

      if (Array.isArray(target)) {
        const prompt = buildDeleteSelectionPrompt(target);
        setPending(from, { kind: "modify_daily_select", candidates: target, prompt });
        return sendTwiml(res, prompt);
      }

      if (Object.keys(updates).length === 0) {
        setPending(from, { kind: "modify_daily", update: target, attempts: 0 });
        return sendTwiml(res, buildDailyUpdateChangePrompt());
      }

      updateDailyUpdateById(target.id, {
        type: updates.update_type ?? undefined,
        time: updates.time,
        location: updates.location,
        query: updates.query,
      });

      return sendTwiml(res, buildDailyUpdateUpdatedMessage({
        ...target,
        update_type: updates.update_type ?? target.type,
        time: updates.time ?? target.time,
        location: updates.location ?? target.location,
        query: updates.query ?? target.query,
      }));
    }

    if (interpretation.intent === "list_reminders") {
      const reminders = listReminders(from);
      clearPending(from);
      return sendTwiml(res, buildListRemindersMessage(reminders));
    }

    if (interpretation.intent === "delete_reminder") {
      clearPending(from);
      const mode = interpretation.delete_mode;
      const query = interpretation.delete_query;

      if (mode === "last") {
        const last = getLastReminder(from);
        if (!last) {
          return sendTwiml(res, "No encontre recordatorios para eliminar.");
        }

        deleteReminderById(last.id);
        clearPending(from);
        return sendTwiml(res, buildDeleteConfirmation(last));
      }

      if (!query) {
        setPending(from, { kind: "delete_query" });
        return sendTwiml(res, "Cual recordatorio queres eliminar? 🗑️");
      }

      return handleDeleteByQuery({ from, query, res });
    }

    if (interpretation.intent === "greeting" || interpretation.intent === "smalltalk") {
      clearPending(from);
      return sendTwiml(res, buildGreetingMessage(isFirstTime));
    }

    if (interpretation.intent === "thanks") {
      clearPending(from);
      return sendTwiml(res, buildThanksMessage());
    }

    if (interpretation.intent === "goodbye") {
      clearPending(from);
      return sendTwiml(res, buildGoodbyeMessage());
    }

    clearPending(from);
    return sendTwiml(res, buildHelpMessage());
  } catch (error) {
    console.error("[webhook] failed to process incoming message", {
      from,
      error: error?.message,
    });
    return sendTwiml(res, "Tuve un problema procesando eso ⚠️ Proba de nuevo en un rato.");
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

startDailyCheck();

function sendTwiml(res, text) {
  res.set("Content-Type", "text/xml");
  return res.send(`<Response><Message>${escapeXml(text)}</Message></Response>`);
}

function escapeXml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseSelection(message, max) {
  const normalized = message.trim().toLowerCase();
  const match = normalized.match(/(?:^|(?:opcion|opción|numero|número)\s*)(\d{1,2})\s*[\.)]?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value) || value < 1 || value > max) return null;
  return value;
}

function isCancelMessage(message) {
  const normalized = message.trim().toLowerCase();
  return normalized === "cancelar" || normalized === "cancela" || normalized === "cancel";
}

function getNextDailyDate(time) {
  const today = getLocalDateString();
  const nowTime = getLocalTimeString();

  if (!time || time > nowTime) {
    return today;
  }

  const date = new Date(`${today}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function handleDeleteByQuery({ from, query, res }) {
  const matches = findRemindersByContent(from, query);

  if (!matches || matches.length === 0) {
    return sendTwiml(res, "No encontre recordatorios con ese texto.");
  }

  if (matches.length === 1) {
    deleteReminderById(matches[0].id);
    clearPending(from);
    return sendTwiml(res, buildDeleteConfirmation(matches[0]));
  }

  const candidates = matches.slice(0, 5);
  const prompt = buildDeleteSelectionPrompt(candidates);
  setPending(from, { kind: "delete_select", candidates, prompt });
  return sendTwiml(res, prompt);
}

function applyDailyUpdateHeuristics(update, message) {
  const normalized = message.trim().toLowerCase();
  if (!update.update_type) {
    const hasWeather = normalized.includes("clima") || normalized.includes("tiempo") || normalized.includes("lluvia");
    const hasNews = normalized.includes("noticia") || normalized.includes("ia") || normalized.includes("inteligencia");
    if (hasWeather && hasNews) {
      update.update_type = "digest";
    } else if (hasWeather) {
      update.update_type = "weather";
    } else if (hasNews) {
      update.update_type = "news";
    }
  }

  if (!update.query) {
    const query = extractNewsQuery(message);
    if (query) update.query = query;
  }

  if (!update.time) {
    const parsed = parseTimeFromMessage(message);
    if (parsed) update.time = parsed;
  }

  const needsLocation = update.update_type === "weather" || update.update_type === "digest";
  if (needsLocation && !update.location) {
    const looksLikeTime = Boolean(parseTimeFromMessage(message));
    const hasDigits = /\d/.test(message);
    if (!looksLikeTime && !hasDigits) {
      const candidate = message.trim();
      if (candidate.length >= 2 && candidate.length <= 60) {
        update.location = candidate;
      }
    }
  }
}

function normalizeDailyUpdateType(update) {
  if (update.update_type === "news_ai") {
    update.update_type = "news";
  }
}

function extractNewsQuery(message) {
  const normalized = message.toLowerCase();
  const match = normalized.match(/noticias\s+(?:de|sobre)\s+(.+)/);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return null;
  return raw.replace(/[.!?]+$/, "");
}

function applyReminderTimeHeuristic(reminder, message) {
  if (!reminder.time) {
    const parsed = parseTimeFromMessage(message);
    if (parsed) reminder.time = parsed;
  }
}

function applyReminderDateHeuristic(reminder, message) {
  if (!reminder.date) {
    const parsed = parseDateFromMessage(message);
    if (parsed) reminder.date = parsed;
  }
}

function parseTimeFromMessage(message) {
  const normalized = message.trim().toLowerCase();
  const isStandalone = /^(?:a\s+las?\s*)?\d{1,2}(?::\d{2})?\s*(am|pm|hs|h)?$/.test(normalized);
  const hasTimeCue = /\b(a\s+las?|a\s+la|am|pm|mañana|tarde|noche)\b/.test(normalized);
  if (!isStandalone && !hasTimeCue) return null;

  let match = normalized.match(/\ba\s+las?\s*(\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    match = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
  }
  if (!match) {
    const periodDefault = getPeriodDefaultTime(normalized);
    if (periodDefault) return periodDefault;
    return null;
  }

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  const suffixMatch = normalized.match(/\b(am|pm)\b/);
  const suffix = suffixMatch ? suffixMatch[1] : null;
  const hasMorning = normalized.includes("mañana");
  const hasAfternoon = normalized.includes("tarde");
  const hasNight = normalized.includes("noche");

  if (suffix === "am" || hasMorning) {
    hours = hours === 12 ? 0 : hours;
  } else if (suffix === "pm" || hasAfternoon || hasNight) {
    hours = hours < 12 ? hours + 12 : hours;
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getPeriodDefaultTime(normalized) {
  if (/\b(a|por|de)\s+la\s+(mañana|manana)\b/.test(normalized)) {
    return "09:00";
  }
  if (/\b(a|por|de)\s+la\s+tarde\b/.test(normalized)) {
    return "17:00";
  }
  if (/\b(a|por|de)\s+la\s+noche\b/.test(normalized)) {
    return "21:00";
  }
  return null;
}

function parseDateFromMessage(message) {
  const normalized = message.trim().toLowerCase();
  const today = getLocalDateString();

  if (normalized.includes("pasado mañana") || normalized.includes("pasadomanana") || normalized.includes("pasado manana")) {
    return addDaysToIso(today, 2);
  }

  if (normalized.includes("mañana") || normalized.includes("manana")) {
    return addDaysToIso(today, 1);
  }

  if (normalized.includes("hoy")) {
    return today;
  }

  return null;
}

function addDaysToIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDailyUpdateMissing(update) {
  const missing = [];
  if (!update.update_type) missing.push("update_type");
  if (!update.time) missing.push("time");
  const needsLocation = update.update_type === "weather" || update.update_type === "digest";
  if (needsLocation && !update.location) missing.push("location");
  return missing;
}

function getReminderMissing(reminder) {
  const missing = [];
  if (!reminder.content) missing.push("content");
  const isDaily = reminder.recurrence === "daily";
  if (isDaily) {
    if (!reminder.time) missing.push("time");
  } else if (!reminder.date) {
    missing.push("date");
  }
  return { missing, isDaily };
}

function extractReminderUpdates(interpretation) {
  const updates = {};
  if (interpretation.content) updates.content = interpretation.content;
  if (interpretation.date) updates.date = interpretation.date;
  if (interpretation.time) updates.time = interpretation.time;
  if (interpretation.recurrence) updates.recurrence = interpretation.recurrence;
  return updates;
}

function extractDailyUpdateUpdates(interpretation) {
  const updates = {};
  if (interpretation.update_type) updates.update_type = interpretation.update_type;
  if (interpretation.time) updates.time = interpretation.time;
  if (interpretation.location) updates.location = interpretation.location;
  if (interpretation.query) updates.query = interpretation.query;
  return updates;
}

function resolveReminderTarget(phone, mode, query) {
  if (mode === "last") {
    return getLastReminder(phone);
  }
  if (mode === "content" && query) {
    const matches = findRemindersByContent(phone, query);
    if (!matches || matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    return matches.slice(0, 5);
  }
  return null;
}

function resolveReminderTargetFromMessage(phone, message) {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("ultimo") || normalized.includes("último")) {
    return getLastReminder(phone);
  }
  const query = message.trim();
  if (!query) return null;
  return resolveReminderTarget(phone, "content", query);
}

function resolveDailyUpdateTarget(phone, mode, query) {
  if (mode === "last") {
    return getLastDailyUpdate(phone);
  }

  if (mode === "type" && query) {
    const normalized = query.toLowerCase();
    if (normalized.includes("clima")) {
      const matches = findDailyUpdatesByType(phone, "weather");
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return matches.slice(0, 5);
      return null;
    }
    if (normalized.includes("noticia")) {
      const matches = [
        ...findDailyUpdatesByType(phone, "news"),
        ...findDailyUpdatesByType(phone, "news_ai"),
      ];
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return matches.slice(0, 5);
      return null;
    }
    if (normalized.includes("digest") || normalized.includes("ambos")) {
      const matches = findDailyUpdatesByType(phone, "digest");
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return matches.slice(0, 5);
      return null;
    }
    const matches = [
      ...findDailyUpdatesByType(phone, "news"),
      ...findDailyUpdatesByType(phone, "news_ai"),
    ];
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return matches.slice(0, 5);
  }

  return null;
}

function resolveDailyUpdateTargetFromMessage(phone, message) {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("ultimo") || normalized.includes("último")) {
    return getLastDailyUpdate(phone);
  }

  if (
    normalized.includes("clima") ||
    normalized.includes("noticia") ||
    normalized.includes("digest") ||
    normalized.includes("ambos")
  ) {
    return resolveDailyUpdateTarget(phone, "type", normalized);
  }

  return null;
}

function isExitMessage(message) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "gracias" ||
    normalized === "muchas gracias" ||
    normalized === "adios" ||
    normalized === "chau" ||
    normalized === "chao" ||
    normalized === "bye"
  );
}

function buildExitResponse(message) {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("gracias")) {
    return buildThanksMessage();
  }
  return buildGoodbyeMessage();
}

function detectSimpleIntent(message) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized === "hola" ||
    normalized === "holi" ||
    normalized === "hey" ||
    normalized === "buen dia" ||
    normalized === "buenas" ||
    normalized === "buenas tardes" ||
    normalized === "buenas noches"
  ) {
    return "greeting";
  }

  if (normalized.includes("gracias")) {
    return "thanks";
  }

  if (
    normalized === "adios" ||
    normalized === "chau" ||
    normalized === "chao" ||
    normalized === "bye"
  ) {
    return "goodbye";
  }

  if (
    normalized.includes("ayuda") ||
    normalized.includes("que podes hacer") ||
    normalized.includes("que puedes hacer") ||
    normalized.includes("que haces") ||
    normalized.includes("menu")
  ) {
    return "help";
  }

  return null;
}
