<<<<<<< HEAD
import express from "express";
=======
import { interpretMessage } from "./services/ia.js";
import { saveReminder } from "./db/reminders.js";
import { startDailyCheck } from "./scheluder/dailyCheck.js";
import { getLocalDateString } from "./utils/date.js";

import express from "express";
import 'dotenv/config';
>>>>>>> 9b981a7 (feat: add daily reminder scheduler and message builder)

const app = express();
const PORT = 3000;

<<<<<<< HEAD
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
=======

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Tatito Bot is running 🤖");
});


app.post("/webhook/whatsapp", async (req, res) => {
  const message = req.body.Body;
  const from = req.body.From;

  const interpretation = await interpretMessage(message);
  
  console.log("🧠 IA result:", interpretation);

  if (interpretation.intent === "reminder") {
    saveReminder({
      phone: from,
      content: interpretation.content,
      date: interpretation.date,
    });

    console.log("💾 Reminder saved");
  }

  res.send(`
    <Response>
      <Message>Perfecto 👍 Ya lo tengo anotado.</Message>
    </Response>
  `);
>>>>>>> 9b981a7 (feat: add daily reminder scheduler and message builder)
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
<<<<<<< HEAD
=======

startDailyCheck();

>>>>>>> 9b981a7 (feat: add daily reminder scheduler and message builder)
