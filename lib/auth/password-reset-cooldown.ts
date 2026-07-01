export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_RATE_LIMIT_COOLDOWN_MS = PASSWORD_RESET_COOLDOWN_MS;

export function getPasswordResetCooldownSeconds(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
