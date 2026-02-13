import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const isDryRun = process.env.WHATSAPP_DRY_RUN === "true";

export async function sendWhatsAppMessage(to, message) {
  console.log("[WhatsApp outgoing]", { to, message, dryRun: isDryRun });

  if (isDryRun) {
    return {
      sid: "dry-run",
      to: `whatsapp:${to}`,
      body: message,
      status: "not-sent"
    };
  }

  return client.messages.create({
    from: "whatsapp:+14155238886",
    to: `whatsapp:${to}`,
    body: message
  });
}
