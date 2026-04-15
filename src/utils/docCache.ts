// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

const DEFAULT_TTL_MS = parseInt(
  process.env.MAPBOX_DOCS_CACHE_TTL_MS ?? '3600000',
  10
);

// Cache limits
const MAX_ENTRIES = 512;
export const MAX_ENTRY_BYTES = 5 * 1024 * 1024; // 5 MB hard cap per entry
const LARGE_ENTRY_WARNING_BYTES = 1 * 1024 * 1024; // warn at 1 MB
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB total

interface CacheEntry {
  content: string;
  expiresAt: number;
  bytes: number;
}

/**
 * Normalize a URL for use as a cache key by stripping query parameters
 * and hash fragments. This prevents cache-busting via unique query strings
 * from creating unbounded cache entries.
 */
export function normalizeCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
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
    // Re-insert to move to end (LRU: most-recently-used stays at the back)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.content;
  }

  set(url: string, content: string, ttlMs: number = DEFAULT_TTL_MS): void {
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_ENTRY_BYTES) {
      console.warn(
        `[docCache] Entry too large to cache (${(bytes / 1024 / 1024).toFixed(1)} MB, limit ${MAX_ENTRY_BYTES / 1024 / 1024} MB): ${url}`
      );
      return;
    }
    if (bytes > LARGE_ENTRY_WARNING_BYTES) {
      console.warn(
        `[docCache] Caching large entry (${(bytes / 1024 / 1024).toFixed(1)} MB): ${url}`
      );
    }

    const key = normalizeCacheKey(url);

    // Remove existing entry for this key if present
    const existing = this.cache.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.cache.delete(key);
    }

    // Evict oldest entries (front of Map) until there is room
    while (
      this.cache.size >= MAX_ENTRIES ||
      this.totalBytes + bytes > MAX_TOTAL_BYTES
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

  /** Exposed for testing only. */
  get size(): number {
    return this.cache.size;
  }

  /** Exposed for testing only. */
  get currentTotalBytes(): number {
    return this.totalBytes;
  }
}

export const docCache = new DocCache();

/**
 * Read a Response body up to `maxBytes`, aborting early if the limit is
 * exceeded. Checks Content-Length first when present so no bytes are
 * buffered for obviously-oversized responses.
 */
export async function readBodyWithLimit(
  response: Response,
  maxBytes: number
): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const cl = parseInt(contentLength, 10);
    if (Number.isFinite(cl) && cl > maxBytes) {
      throw new Error(
        `Response too large: Content-Length ${cl} exceeds limit of ${maxBytes} bytes`
      );
    }
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('Response too large');
    }
    return text;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const reader = response.body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error('Response too large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString('utf8');
}
