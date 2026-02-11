const pendingByPhone = new Map();

export function getPending(phone) {
  return pendingByPhone.get(phone);
}

export function setPending(phone, state) {
  pendingByPhone.set(phone, state);
}

export function clearPending(phone) {
  pendingByPhone.delete(phone);
}

