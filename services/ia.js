import OpenAI from "openai";
import "dotenv/config";

import { getLocalDateString } from "../utils/date.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(message, context = {}) {
  const today = getLocalDateString();

  const pendingContext = context.pending
    ? `Known pending reminder state (never blank these values if the user is only adding missing data):\n${JSON.stringify(context.pending)}`
    : "No pending reminder state exists for this user.";

  const prompt = `
You are a structured extraction assistant for a WhatsApp personal reminder bot.

Today is ${today}.

You must return ONLY valid JSON with this exact schema:
{
  "intent": "",
  "content": "",
  "date": null,
  "time": null,
  "recurrence": null,
  "update_type": null,
  "location": null,
  "query": null,
  "update_mode": null,
  "update_query": null,
  "delete_mode": null,
  "delete_query": null,
  "needs_clarification": false,
  "missing_fields": [],
  "clarification_question": null,
  "pending_state": null
}

Rules:
- Be conservative: if uncertain, ask clarification instead of guessing.
- Never return past dates.
- Intents: reminder, daily_update, update_reminder, update_daily_update, delete_reminder, list_reminders, greeting, thanks, goodbye, smalltalk, daily_summary, note, unknown.
- If user is answering a follow-up, merge new info with pending state.
- Never replace known fields with empty string, null, or undefined.
- If needs_clarification=true, pending_state is required and must include the known keys for that intent.
  - For reminder: intent, content, date, time, recurrence
  - For daily_update: intent, update_type, time, location, query
- If content is missing for a reminder, include "content" in missing_fields.
- If date is missing for a one-time reminder, include "date" in missing_fields.
- If a daily reminder is requested, set recurrence="daily" and require time.
- If time is missing for a daily reminder, include "time" in missing_fields.
- Time must be in 24h format "HH:MM".
- For daily_update:
  - update_type: "news" | "weather" | "digest"
  - time is required
  - location is required for weather and digest
  - query is optional for news (default to "inteligencia artificial" if missing)
  - If missing required fields, include them in missing_fields.
- For update_reminder:
  - update_mode: "last" or "content"
  - update_query is required if update_mode="content"
  - You can include any of: content, date, time, recurrence as fields to change
- For update_daily_update:
  - update_mode: "last" or "type"
  - update_query is required if update_mode="type" (values: "weather", "news", "digest")
  - You can include any of: update_type, time, location, query as fields to change
- For delete_reminder, use delete_mode:
  - "last" if user says last/ultimo
  - "content" if user describes the reminder to delete
  - If delete_mode="content", include delete_query with the text to match
- If delete_reminder is missing required info, include "delete_query" in missing_fields.
- clarification_question must be short, natural Spanish.
- For greeting/thanks/goodbye/smalltalk, do not set needs_clarification.

${pendingContext}

Examples:
- "elimina mi ultimo recordatorio" -> intent=delete_reminder, delete_mode=last
- "borra el recordatorio del medico" -> intent=delete_reminder, delete_mode=content, delete_query="medico"
- "listame mis recordatorios" -> intent=list_reminders
- "hola" -> intent=greeting
- "gracias" -> intent=thanks
- "adios" -> intent=goodbye
- "todos los dias a las 9 enviame noticias de IA" -> intent=daily_update, update_type=news, query="inteligencia artificial", time="09:00"
- "informe diario del clima en cordoba a las 7" -> intent=daily_update, update_type=weather, time="07:00", location="Cordoba"
- "cambia la hora de mi ultimo recordatorio a las 9" -> intent=update_reminder, update_mode=last, time="09:00"
- "modifica el informe del clima para las 8" -> intent=update_daily_update, update_mode=type, update_query="weather", time="08:00"

User message:
"${message}"
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Return strict JSON only. No markdown, no extra text.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(raw);
  } catch {
    return {
      intent: "unknown",
      content: "",
      date: null,
      time: null,
      recurrence: null,
      update_type: null,
      location: null,
      query: null,
      update_mode: null,
      update_query: null,
      delete_mode: null,
      delete_query: null,
      needs_clarification: true,
      missing_fields: ["content", "date"],
      clarification_question: "No entendi bien. Que te recuerdo y para que dia?",
      pending_state: {
        intent: "reminder",
        content: "",
        date: null,
        time: null,
        recurrence: null,
      },
    };
  }
}
