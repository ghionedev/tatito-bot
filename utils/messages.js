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
  if (!date) {
    return "Dale \u{1F44D} \u00BFQu\u00E9 quer\u00E9s que te recuerde?";
  }

  const { label, short } = humanizeDate(date);
  return `Perfecto. \u00BFQu\u00E9 quer\u00E9s que te recuerde para ${label} (${short})?`;
}

export function buildMissingDateQuestion() {
  return "Perfecto. \u00BFPara qu\u00E9 d\u00EDa?";
}

export function buildClarificationMessage({ missingFields, date }) {
  const missing = missingFields ?? [];
  const missingContent = missing.includes("content");
  const missingDate = missing.includes("date");

  if (missingContent) {
    return buildMissingContentQuestion(date);
  }

  if (missingDate) {
    return buildMissingDateQuestion();
  }

  return "Necesito un dato m\u00E1s para ayudarte.";
}

export function buildGenericClarification(question) {
  return question || "Necesito un dato m\u00E1s para ayudarte.";
}

export function buildUnknownIntentMessage() {
  return "Te leo \u{1F440} Si quer\u00E9s, decime qu\u00E9 quer\u00E9s que te recuerde.";
}
