export function mergePending(oldState = {}, newState = {}) {
  const pick = (newVal, oldVal) => {
    if (newVal === null || newVal === undefined) return oldVal;
    if (typeof newVal === "string" && newVal.trim() === "") return oldVal;
    return newVal;
  };

  return {
    intent: pick(newState.intent, oldState.intent),
    content: pick(newState.content, oldState.content),
    date: pick(newState.date, oldState.date),
    time: pick(newState.time, oldState.time),
    recurrence: pick(newState.recurrence, oldState.recurrence),
    update_type: pick(newState.update_type, oldState.update_type),
    location: pick(newState.location, oldState.location),
    query: pick(newState.query, oldState.query),
  };
}
