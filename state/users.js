const seenUsers = new Set();

export function hasSeenIntro(phone) {
  return seenUsers.has(phone);
}

export function markSeenIntro(phone) {
  seenUsers.add(phone);
}
