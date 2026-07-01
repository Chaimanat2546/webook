const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 1;

interface PasswordResetAttempt {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, PasswordResetAttempt>();

export function consumePasswordResetRateLimit(key: string, now = Date.now()): boolean {
  // ponytail: in-process per-email throttle; use a shared store if multi-instance limits must be strict.
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= MAX_ATTEMPTS) {
    return false;
  }

  current.count += 1;
  return true;
}

export function clearPasswordResetRateLimitForTests() {
  attempts.clear();
}
