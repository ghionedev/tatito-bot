import { interpretMessage } from "./services/ia.js";
import { saveReminder } from "./db/reminders.js";
import { startDailyCheck } from "./scheluder/dailyCheck.js";
import { getPending, setPending, clearPending } from "./state/pending.js";
import { mergePending } from "./state/mergePending.js";
import {
  buildConfirmationMessage,
  buildMissingContentQuestion,
  buildGenericClarification,
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

  const pending = getPending(from);
  const interpretation = await interpretMessage(message, { pending });

  console.log("IA result:", interpretation);

  if (interpretation.needs_clarification) {
    const merged = mergePending(pending, interpretation.pending_state);
    setPending(from, merged);

    const missingFields = interpretation.missing_fields ?? [];
    const hasDate = Boolean(merged?.date);

    const clarificationMessage =
      missingFields.includes("content") && hasDate
        ? buildMissingContentQuestion(merged.date)
        : buildGenericClarification(
            interpretation.clarification_question ||
              "Me faltan datos para agendarlo."
          );

    res.type("text/xml").send(toTwiml(clarificationMessage));
    return;
  }

  if (interpretation.intent === "reminder") {
    const completed = mergePending(pending, interpretation.pending_state);

    if (!completed?.content || !completed?.date) {
      setPending(from, completed);
      res
        .type("text/xml")
        .send(toTwiml("Me falta info. Que queres recordar y para cuando?"));
      return;
    }

    saveReminder({
      phone: from,
      content: completed.content,
      date: completed.date,
      time: completed.time,
    });

    clearPending(from);

    const confirmation = buildConfirmationMessage({
      content: completed.content,
      date: completed.date,
      time: completed.time,
    });

    res.type("text/xml").send(toTwiml(confirmation));
    return;
  }

  res
    .type("text/xml")
    .send(toTwiml("Te leo. Si queres, te ayudo a crear un recordatorio."));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

startDailyCheck();