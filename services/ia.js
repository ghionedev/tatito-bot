import OpenAI from "openai";
import "dotenv/config";
import { getLocalDateString } from "../utils/date.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(message, context = { pending: null }) {
  const today = getLocalDateString();
  const pending = context?.pending ?? null;

  const prompt = `
You are Tatito, a WhatsApp personal assistant. Reply with ONLY a valid JSON object.

Today is ${today}.
Current pending state (may be null): ${JSON.stringify(pending)}

Return this exact shape:
{
  "intent": "reminder" | "daily_summary" | "note" | "unknown",
  "content": string,
  "date": "YYYY-MM-DD" | null,
  "time": string | null,
  "needs_clarification": boolean,
  "missing_fields": string[],
  "clarification_question": string | null,
  "pending_state": {
    "intent": "reminder" | "daily_summary" | "note" | "unknown" | null,
    "content": string | null,
    "date": "YYYY-MM-DD" | null,
    "time": string | null
  } | null
}

Rules:
- Never return past dates.
- If reminder is missing content or date: set needs_clarification=true.
- missing_fields must include "content" and/or "date" when missing.
- clarification_question must be short and natural in Spanish.
- pending_state should include the best known reminder fields so backend can merge safely.
- If message does not map clearly to a supported intent, use "unknown".

User message:
"${message}"
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}