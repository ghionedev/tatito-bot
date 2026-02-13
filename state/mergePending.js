function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

export function mergePending(oldState, newState) {
  const base = oldState ?? {};
  const incoming = newState ?? {};
  const merged = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (hasValue(value)) {
      merged[key] = value;
    }
  }

  return merged;
}