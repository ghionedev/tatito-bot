import { humanizeDate } from "./humanizeDate.js";
import { getLocalDateString } from "./date.js";

export function buildConfirmationMessage(reminder) {
  const today = getLocalDateString();
  const { label, short } = humanizeDate(reminder.date, today);
  const timeText = reminder.time ? ` a las ${reminder.time}` : "";

  if (reminder.recurrence === "daily") {
    const dailyTime = reminder.time ? ` a las ${reminder.time}` : "";
    return `Listo ✅ Todos los dias${dailyTime} te recuerdo: ${reminder.content}.`;
  }

  if (label && short) {
    return `Listo ✅ ${capitalize(label)} (${short})${timeText} te recuerdo: ${reminder.content}.`;
  }

  return `Listo ✅ Te recuerdo: ${reminder.content}.`;
}

export function buildMissingContentQuestion(date) {
  const today = getLocalDateString();
  const { label, short } = humanizeDate(date, today);

  if (!label || !short) {
    return "Que queres que te recuerde?";
  }

  return `Perfecto 👍 Que queres que te recuerde para ${label} (${short})?`;
}

export function buildMissingTimeQuestion(isDaily) {
  if (isDaily) {
    return "A que hora queres el recordatorio de todos los dias? ⏰";
  }
  return "A que hora queres el recordatorio? ⏰";
}

export function buildMissingLocationQuestion(attempts = 0) {
  if (attempts >= 1) {
    return "Necesito la ciudad para el informe del clima. Ej: Cordoba, Rosario, Buenos Aires.";
  }
  return "Para que ciudad queres el informe del clima?";
}

export function buildMissingUpdateTypeQuestion() {
  return "Que tipo de informe diario queres? Noticias de IA, clima o ambos.";
}

export function buildGenericClarification(question) {
  if (typeof question === "string" && question.trim() !== "") {
    return question.trim();
  }

  return "Me falta un dato para ayudarte. Me lo pasas?";
}

export function buildListRemindersMessage(reminders) {
  if (!reminders || reminders.length === 0) {
    return "No tenes recordatorios guardados por ahora.";
  }

  const lines = reminders.map((reminder, index) => {
    return `${index + 1}. ${reminder.content} - ${formatWhen(reminder)}`;
  });

  return `📋 Tus recordatorios:\n${lines.join("\n")}`;
}

export function buildDeleteConfirmation(reminder) {
  return `Listo ✅ Elimine: ${reminder.content}.`;
}

export function buildDeleteSelectionPrompt(candidates) {
  const lines = candidates.map((reminder, index) => {
    return `${index + 1}. ${reminder.content} - ${formatWhen(reminder)}`;
  });

  return `Encontre varios 🔎 Responde con el numero:\n${lines.join("\n")}`;
}

export function buildGreetingMessage(isFirstTime) {
  if (isFirstTime) {
    return buildIntroMessage();
  }
  return "Hola 👋 Queres que te recuerde algo?";
}

export function buildThanksMessage() {
  return "De nada 😊 Si necesitas otro recordatorio, avisame.";
}

export function buildGoodbyeMessage() {
  return "Adios 👋 Cuando quieras, puedo ayudarte con recordatorios.";
}

export function buildIntroMessage() {
  return "Hola 👋 Soy Tatito. Puedo crear, listar y eliminar recordatorios, y enviar informes diarios. Queres que te recuerde algo?";
}

export function buildHelpMessage() {
  return "Puedo crear, listar, eliminar o modificar recordatorios, y enviar informes diarios. Queres que te recuerde algo?";
}

export function buildDailyUpdateConfirmation(update) {
  const timeText = update.time ? ` a las ${update.time}` : "";
  switch (update.update_type) {
    case "news_ai":
    case "news": {
      const topic = update.query ? ` sobre ${update.query}` : "";
      return `Listo ✅ Todos los dias${timeText} te envio noticias${topic}.\nQueres cambiar algo?`;
    }
    case "weather":
      return `Listo ✅ Todos los dias${timeText} te envio el clima${update.location ? ` en ${update.location}` : ""}.\nQueres cambiar algo?`;
    case "digest":
      return `Listo ✅ Todos los dias${timeText} te envio clima y noticias.\nQueres cambiar algo?`;
    default:
      return `Listo ✅ Informe diario configurado${timeText}.\nQueres cambiar algo?`;
  }
}

export function buildReminderUpdatePrompt() {
  return "Que queres cambiar del recordatorio? Fecha, hora o contenido.";
}

export function buildDailyUpdateChangePrompt() {
  return "Que queres cambiar del informe? Hora, tema de noticias o ciudad.";
}

export function buildReminderUpdatedMessage(reminder) {
  const today = getLocalDateString();
  const { label, short } = humanizeDate(reminder.date, today);
  const timeText = reminder.time ? ` a las ${reminder.time}` : "";
  const whenText = label && short ? `${label} (${short})` : reminder.date ?? "sin fecha";
  return `Listo ✅ Actualice el recordatorio: ${reminder.content} - ${whenText}${timeText}.`;
}

export function buildDailyUpdateUpdatedMessage(update) {
  const timeText = update.time ? ` a las ${update.time}` : "";
  if (update.update_type === "weather") {
    return `Listo ✅ Actualice el informe del clima${update.location ? ` en ${update.location}` : ""}${timeText}.`;
  }
  if (update.update_type === "news" || update.update_type === "news_ai") {
    const topic = update.query ? ` sobre ${update.query}` : "";
    return `Listo ✅ Actualice el informe de noticias${topic}${timeText}.`;
  }
  if (update.update_type === "digest") {
    return `Listo ✅ Actualice el informe diario combinado${timeText}.`;
  }
  return `Listo ✅ Actualice el informe diario${timeText}.`;
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatWhen(reminder) {
  if (reminder.recurrence === "daily") {
    const timeText = reminder.time ? ` a las ${reminder.time}` : "";
    return `todos los dias${timeText}`;
  }

  const today = getLocalDateString();
  const { label, short } = humanizeDate(reminder.date, today);
  const timeText = reminder.time ? ` a las ${reminder.time}` : "";

  if (label && short) {
    return `${label} (${short})${timeText}`;
  }

  return reminder.date ? `${reminder.date}${timeText}` : `sin fecha${timeText}`;
}
