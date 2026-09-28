import type { BookingGalleryCard } from "./booking-gallery.ts";

export type GalleryPairState =
  | { status: "loading" }
  | { status: "ready"; card: BookingGalleryCard }
  | { status: "error"; message: string };

interface Entry { token: number; state: GalleryPairState }
export interface GalleryVisiblePair { propertyId: string; month: string }
export interface GalleryMonthGroup { month: string; propertyIds: string[] }

const maxPairs = 24;
const pairKey = (propertyId: string, month: string) => `${propertyId}:${month}`;

export class GalleryPairCache {
  private entries = new Map<string, Entry>();
  private sequence = 0;

  get size(): number { return this.entries.size; }

  snapshot(): Record<string, GalleryPairState> {
    const states: Record<string, GalleryPairState> = {};
    for (const [key, entry] of this.entries) {
      states[key] = entry.state;
    }
    return states;
  }

  read(propertyId: string, month: string): GalleryPairState | null {
    const key = pairKey(propertyId, month);
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.state;
  }

  start(propertyId: string, month: string, force = false): number | null {
    if (!force && this.read(propertyId, month)) return null;
    const key = pairKey(propertyId, month);
    const token = ++this.sequence;
    this.entries.delete(key);
    this.entries.set(key, { token, state: { status: "loading" } });
    while (this.entries.size > maxPairs) this.entries.delete(this.entries.keys().next().value!);
    return token;
  }

  resolve(propertyId: string, month: string, token: number, card: BookingGalleryCard): boolean {
    const key = pairKey(propertyId, month);
    const entry = this.entries.get(key);
    if (!entry || entry.token !== token) return false;
    this.entries.delete(key);
    this.entries.set(key, { token, state: { status: "ready", card } });
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

export function groupGalleryPairsByMonth(cache: GalleryPairCache, pairs: GalleryVisiblePair[]): GalleryMonthGroup[] {
  const groups = new Map<string, string[]>();
  for (const pair of pairs) {
    if (cache.read(pair.propertyId, pair.month)) continue;
    const ids = groups.get(pair.month) ?? [];
    ids.push(pair.propertyId);
    groups.set(pair.month, ids);
  }
  return [...groups].map(([month, propertyIds]) => ({ month, propertyIds }));
}
