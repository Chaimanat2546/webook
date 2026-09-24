import type { BookingGalleryCard } from "./booking-gallery.ts";

export type GalleryPairState =
  | { status: "loading" }
  | { status: "ready"; card: BookingGalleryCard; loadedAt: number }
  | { status: "error"; message: string };

interface Entry { token: number; state: GalleryPairState }
export interface GalleryVisiblePair { propertyId: string; month: string }
export interface GalleryMonthGroup { month: string; propertyIds: string[] }

const maxPairs = 24;
const freshMilliseconds = 30_000;
const pairKey = (propertyId: string, month: string) => `${propertyId}:${month}`;

export class GalleryPairCache {
  private entries = new Map<string, Entry>();
  private sequence = 0;

  get size(): number { return this.entries.size; }

  snapshot(now: number): Record<string, GalleryPairState> {
    const states: Record<string, GalleryPairState> = {};
    for (const [key, entry] of this.entries) {
      if (entry.state.status !== "ready" || now - entry.state.loadedAt < freshMilliseconds) states[key] = entry.state;
    }
    return states;
  }

  nextExpiry(now: number): number | null {
    let next: number | null = null;
    for (const entry of this.entries.values()) {
      if (entry.state.status !== "ready") continue;
      const expiresAt = entry.state.loadedAt + freshMilliseconds;
      if (expiresAt > now && (next === null || expiresAt < next)) next = expiresAt;
    }
    return next;
  }

  read(propertyId: string, month: string, now: number): GalleryPairState | null {
    const key = pairKey(propertyId, month);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.state.status === "ready" && now - entry.state.loadedAt >= freshMilliseconds) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.state;
  }

  start(propertyId: string, month: string, now: number, force = false): number | null {
    if (!force && this.read(propertyId, month, now)) return null;
    const key = pairKey(propertyId, month);
    const token = ++this.sequence;
    this.entries.delete(key);
    this.entries.set(key, { token, state: { status: "loading" } });
    while (this.entries.size > maxPairs) this.entries.delete(this.entries.keys().next().value!);
    return token;
  }

  resolve(propertyId: string, month: string, token: number, card: BookingGalleryCard, now: number): boolean {
    const key = pairKey(propertyId, month);
    const entry = this.entries.get(key);
    if (!entry || entry.token !== token) return false;
    this.entries.delete(key);
    this.entries.set(key, { token, state: { status: "ready", card, loadedAt: now } });
    return true;
  }

  reject(propertyId: string, month: string, token: number, message: string): boolean {
    const key = pairKey(propertyId, month);
    const entry = this.entries.get(key);
    if (!entry || entry.token !== token) return false;
    this.entries.set(key, { token, state: { status: "error", message } });
    return true;
  }

  invalidateHouse(propertyId: string): void {
    for (const key of this.entries.keys()) if (key.startsWith(`${propertyId}:`)) this.entries.delete(key);
  }
}

export function groupGalleryPairsByMonth(cache: GalleryPairCache, pairs: GalleryVisiblePair[], now: number): GalleryMonthGroup[] {
  const groups = new Map<string, string[]>();
  for (const pair of pairs) {
    if (cache.read(pair.propertyId, pair.month, now)) continue;
    const ids = groups.get(pair.month) ?? [];
    ids.push(pair.propertyId);
    groups.set(pair.month, ids);
  }
  return [...groups].map(([month, propertyIds]) => ({ month, propertyIds }));
}
