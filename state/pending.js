const pendingByPhone = new Map();

// 10 minutos por defecto
const PENDING_TTL_MS = Number(process.env.PENDING_TTL_MS ?? 10 * 60 * 1000);

export function getPending(phone) {
  const entry = pendingByPhone.get(phone);
  if (!entry) return null;

  const age = Date.now() - entry.updatedAt;

  if (age > PENDING_TTL_MS) {
    pendingByPhone.delete(phone);
    return null;
  }

  return entry;
}

export function setPending(phone, state) {
  const now = Date.now();

  pendingByPhone.set(phone, {
    ...state,
    updatedAt: now,
  });
}

export function clearPending(phone) {
  pendingByPhone.delete(phone);
}
