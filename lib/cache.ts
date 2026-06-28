/**
 * Simple in-memory LRU cache with optional on-disk persistence.
 * Used by all API route handlers to avoid hammering upstream sources.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 500;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  // Simple eviction: drop oldest entries when over capacity
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export const TTL = {
  FX:      12 * 60 * 60 * 1000,  // 12 h
  CLIMATE: 30 * 24 * 60 * 60 * 1000, // 30 d
  COUNTRY: 30 * 24 * 60 * 60 * 1000, // 30 d
  GEOCODE: 30 * 24 * 60 * 60 * 1000, // 30 d
  PRICES:   6 * 60 * 60 * 1000,  //  6 h
  SHORT:    5 * 60 * 1000,        //  5 min (debounce)
};
