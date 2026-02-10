import twilio from "twilio";
import "dotenv/config";

console.log("SID:", process.env.TWILIO_ACCOUNT_SID);

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

client.messages
  .create({
    from: "whatsapp:+14155238886",
    to: "whatsapp:+61494565867",
    body: "TEST DIRECTO — si esto llega, Twilio está OK 🔥"
  })
  .then(msg => console.log("SENT OK:", msg.sid))
  .catch(err => console.error("ERROR:", err));

  