// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeCacheKey } from '../../src/utils/docCache.js';

// Re-create an isolated DocCache class for each test so we don't share
// global singleton state.
async function makeCache(
  overrides: {
    maxEntries?: number;
    maxEntryBytes?: number;
    maxTotalBytes?: number;
    defaultTtlMs?: number;
  } = {}
) {
  const {
    maxEntries = 512,
    maxEntryBytes = 2 * 1024 * 1024,
    maxTotalBytes = 50 * 1024 * 1024,
    defaultTtlMs = 3_600_000
  } = overrides;

  interface CacheEntry {
    content: string;
    expiresAt: number;
    bytes: number;
  }

  class DocCache {
    private cache = new Map<string, CacheEntry>();
    private totalBytes = 0;

    get(url: string): string | null {
      const key = normalizeCacheKey(url);
      const entry = this.cache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        this.totalBytes -= entry.bytes;
        this.cache.delete(key);
        return null;
      }
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.content;
    }

    set(url: string, content: string, ttlMs: number = defaultTtlMs): void {
      const bytes = Buffer.byteLength(content, 'utf8');
      if (bytes > maxEntryBytes) return;

      const key = normalizeCacheKey(url);
      const existing = this.cache.get(key);
      if (existing) {
        this.totalBytes -= existing.bytes;
        this.cache.delete(key);
      }

      while (
        this.cache.size >= maxEntries ||
        this.totalBytes + bytes > maxTotalBytes
      ) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey === undefined) break;
        const oldest = this.cache.get(oldestKey)!;
        this.totalBytes -= oldest.bytes;
        this.cache.delete(oldestKey);
      }

      this.cache.set(key, { content, expiresAt: Date.now() + ttlMs, bytes });
      this.totalBytes += bytes;
    }

    has(url: string): boolean {
      return this.get(url) !== null;
    }

    clear(): void {
      this.cache.clear();
      this.totalBytes = 0;
    }

    get size(): number {
      return this.cache.size;
    }

    get currentTotalBytes(): number {
      return this.totalBytes;
    }
  }

  return new DocCache();
}

describe('normalizeCacheKey', () => {
  it('strips query parameters', () => {
    expect(normalizeCacheKey('https://docs.mapbox.com/page?x=1&y=2')).toBe(
      'https://docs.mapbox.com/page'
    );
  });

  it('strips hash fragments', () => {
    expect(normalizeCacheKey('https://docs.mapbox.com/page#section')).toBe(
      'https://docs.mapbox.com/page'
    );
  });

  it('strips both query params and hash', () => {
    expect(normalizeCacheKey('https://docs.mapbox.com/page?x=1#section')).toBe(
      'https://docs.mapbox.com/page'
    );
  });

  it('leaves clean URLs unchanged', () => {
    expect(normalizeCacheKey('https://docs.mapbox.com/api/maps/')).toBe(
      'https://docs.mapbox.com/api/maps/'
    );
  });

  it('returns the original string for invalid URLs', () => {
    expect(normalizeCacheKey('not-a-url')).toBe('not-a-url');
  });
});

describe('DocCache', () => {
  describe('basic get/set/has', () => {
    it('stores and retrieves content', async () => {
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page', 'hello');
      expect(cache.get('https://docs.mapbox.com/page')).toBe('hello');
    });

    it('returns null for missing keys', async () => {
      const cache = await makeCache();
      expect(cache.get('https://docs.mapbox.com/missing')).toBeNull();
    });

    it('has() returns true for present entries', async () => {
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page', 'hello');
      expect(cache.has('https://docs.mapbox.com/page')).toBe(true);
    });

    it('has() returns false for missing entries', async () => {
      const cache = await makeCache();
      expect(cache.has('https://docs.mapbox.com/missing')).toBe(false);
    });

    it('clear() empties the cache', async () => {
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page', 'hello');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.currentTotalBytes).toBe(0);
    });
  });

  describe('TTL expiry', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null for expired entries', async () => {
      vi.useFakeTimers();
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page', 'hello', 1000);
      vi.advanceTimersByTime(1001);
      expect(cache.get('https://docs.mapbox.com/page')).toBeNull();
    });

    it('removes expired entry from size count', async () => {
      vi.useFakeTimers();
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page', 'hello', 1000);
      vi.advanceTimersByTime(1001);
      cache.get('https://docs.mapbox.com/page');
      expect(cache.size).toBe(0);
      expect(cache.currentTotalBytes).toBe(0);
    });
  });

  describe('URL normalization', () => {
    it('treats URLs with different query params as the same key', async () => {
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page', 'original');
      // Cache-busting query param should not create a new entry
      expect(cache.get('https://docs.mapbox.com/page?bust=123')).toBe(
        'original'
      );
    });

    it('set with query-param URL writes to normalized key', async () => {
      const cache = await makeCache();
      cache.set('https://docs.mapbox.com/page?x=1', 'hello');
      expect(cache.get('https://docs.mapbox.com/page')).toBe('hello');
      expect(cache.size).toBe(1);
    });

    it('multiple cache-busting URLs do not inflate entry count', async () => {
      const cache = await makeCache();
      for (let i = 0; i < 10; i++) {
        cache.set(`https://docs.mapbox.com/page?bust=${i}`, `content${i}`);
      }
      expect(cache.size).toBe(1);
    });
  });

  describe('max entry limit (LRU eviction)', () => {
    it('does not exceed MAX_ENTRIES', async () => {
      const cache = await makeCache({ maxEntries: 5 });
      for (let i = 0; i < 10; i++) {
        cache.set(`https://docs.mapbox.com/page${i}`, `content${i}`);
      }
      expect(cache.size).toBe(5);
    });

    it('evicts the oldest entry first', async () => {
      const cache = await makeCache({ maxEntries: 3 });
      cache.set('https://docs.mapbox.com/a', 'a');
      cache.set('https://docs.mapbox.com/b', 'b');
      cache.set('https://docs.mapbox.com/c', 'c');
      // Adding a 4th should evict /a (oldest)
      cache.set('https://docs.mapbox.com/d', 'd');
      expect(cache.get('https://docs.mapbox.com/a')).toBeNull();
      expect(cache.get('https://docs.mapbox.com/b')).toBe('b');
      expect(cache.get('https://docs.mapbox.com/d')).toBe('d');
    });

    it('a recently accessed entry is not the first evicted', async () => {
      const cache = await makeCache({ maxEntries: 3 });
      cache.set('https://docs.mapbox.com/a', 'a');
      cache.set('https://docs.mapbox.com/b', 'b');
      cache.set('https://docs.mapbox.com/c', 'c');
      // Access /a to move it to the end (LRU)
      cache.get('https://docs.mapbox.com/a');
      // Adding /d should evict /b (now the oldest)
      cache.set('https://docs.mapbox.com/d', 'd');
      expect(cache.get('https://docs.mapbox.com/b')).toBeNull();
      expect(cache.get('https://docs.mapbox.com/a')).toBe('a');
    });
  });

  describe('per-entry size limit', () => {
    it('rejects entries larger than MAX_ENTRY_BYTES', async () => {
      const cache = await makeCache({ maxEntryBytes: 100 });
      const bigContent = 'x'.repeat(101);
      cache.set('https://docs.mapbox.com/page', bigContent);
      expect(cache.get('https://docs.mapbox.com/page')).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('accepts entries at exactly MAX_ENTRY_BYTES', async () => {
      const cache = await makeCache({ maxEntryBytes: 100 });
      const content = 'x'.repeat(100);
      cache.set('https://docs.mapbox.com/page', content);
      expect(cache.get('https://docs.mapbox.com/page')).toBe(content);
    });

    it('warns and rejects when entry exceeds hard cap', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // Use the real docCache singleton via a tiny cap override isn't possible,
        // so we verify the warning path via the real module with a 5MB content.
        // Instead, test the warning logic on the actual singleton with a spy.
        const { docCache: real } = await import('../../src/utils/docCache.js');
        real.clear();
        // Content just over 5MB hard cap
        const oversized = 'x'.repeat(5 * 1024 * 1024 + 1);
        real.set('https://docs.mapbox.com/page', oversized);
        expect(real.get('https://docs.mapbox.com/page')).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('too large to cache')
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('warns but caches entries between 1MB and 5MB', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { docCache: real } = await import('../../src/utils/docCache.js');
        real.clear();
        // Content just over the 1MB warning threshold but under the 5MB cap
        const large = 'x'.repeat(1 * 1024 * 1024 + 1);
        real.set('https://docs.mapbox.com/page', large);
        expect(real.get('https://docs.mapbox.com/page')).toBe(large);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Caching large entry')
        );
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('total bytes limit', () => {
    it('evicts entries when total bytes would be exceeded', async () => {
      const cache = await makeCache({
        maxEntries: 100,
        maxEntryBytes: 200,
        maxTotalBytes: 300
      });
      // Each entry is 150 bytes; two fit (300), third evicts first
      const content150 = 'x'.repeat(150);
      cache.set('https://docs.mapbox.com/a', content150);
      cache.set('https://docs.mapbox.com/b', content150);
      expect(cache.size).toBe(2);
      cache.set('https://docs.mapbox.com/c', content150);
      // /a should be evicted to make room
      expect(cache.size).toBe(2);
      expect(cache.get('https://docs.mapbox.com/a')).toBeNull();
      expect(cache.get('https://docs.mapbox.com/b')).toBe(content150);
      expect(cache.get('https://docs.mapbox.com/c')).toBe(content150);
    });

    it('tracks currentTotalBytes correctly after eviction', async () => {
      const cache = await makeCache({
        maxEntries: 100,
        maxEntryBytes: 200,
        maxTotalBytes: 300
      });
      const content150 = 'x'.repeat(150);
      cache.set('https://docs.mapbox.com/a', content150);
      cache.set('https://docs.mapbox.com/b', content150);
      cache.set('https://docs.mapbox.com/c', content150);
      // After eviction: /b and /c remain (300 bytes total)
      expect(cache.currentTotalBytes).toBe(300);
    });
  });
});
