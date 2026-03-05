// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

const DEFAULT_TTL_MS = parseInt(
  process.env.MAPBOX_DOCS_CACHE_TTL_MS ?? '3600000',
  10
);

interface CacheEntry {
  content: string;
  expiresAt: number;
}

class DocCache {
  private cache = new Map<string, CacheEntry>();

  get(url: string): string | null {
    const entry = this.cache.get(url);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(url);
      return null;
    }
    return entry.content;
  }

  set(url: string, content: string, ttlMs: number = DEFAULT_TTL_MS): void {
    this.cache.set(url, { content, expiresAt: Date.now() + ttlMs });
  }

  has(url: string): boolean {
    return this.get(url) !== null;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const docCache = new DocCache();
