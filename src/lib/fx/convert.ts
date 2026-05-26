export function convertCents(amountCents: number, rate: number): number {
  const raw = amountCents * rate;
  const floor = Math.floor(raw);
  const diff = raw - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}
