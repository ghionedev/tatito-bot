import OpenAI from "openai";
import 'dotenv/config';
import { getLocalDateString } from "../utils/date.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function interpretMessage(message) {
const today = getLocalDateString();

const prompt = `
You are a personal assistant.
Today's date is ${today}.

Extract the user's intent and return ONLY valid JSON.

Possible intents:
- reminder
- daily_summary
- note
- unknown

If it's a reminder:
- Extract date and time
- NEVER return past dates
- If user says "today" or "tomorrow", calculate based on today's date
- Return date in ISO format (YYYY-MM-DD)

User message:
"${message}"

JSON format:
{
  "intent": "",
  "content": "",
  "date": null
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  return JSON.parse(response.choices[0].message.content);
}
