function validDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value ? null : milliseconds;
}

export function dashboardShare(amountCents: number, totalCents: number): number | null {
  if (!Number.isSafeInteger(amountCents) || !Number.isSafeInteger(totalCents) || totalCents <= 0) return null;
  return amountCents / totalCents * 100;
}

export function dashboardNights(checkIn: string, checkOut: string): number | null {
  const start = validDateOnly(checkIn);
  const end = validDateOnly(checkOut);
  if (start === null || end === null) return null;
  const nights = (end - start) / (24 * 60 * 60 * 1000);
  return nights > 0 && Number.isSafeInteger(nights) ? nights : null;
}
