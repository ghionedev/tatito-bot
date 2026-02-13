import { humanizeDate } from "./humanizeDate.js";

function capitalize(text) {
  if (!text) return text;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function buildConfirmationMessage({ content, date, time }) {
  const { label, short } = humanizeDate(date);
  const labelText = capitalize(label);
  const timeChunk = time ? ` a las ${time}` : "";
  return `Listo. ${labelText} (${short})${timeChunk} te recuerdo: ${content}.`;
}

export function buildMissingContentQuestion(date) {
  const { label, short } = humanizeDate(date);
  return `Perfecto. Que queres que te recuerde para ${label} (${short})?`;
}

export function buildGenericClarification(question) {
  return question;
}