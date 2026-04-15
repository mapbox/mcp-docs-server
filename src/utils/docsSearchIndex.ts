// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import type { HttpRequest } from './types.js';
import { fetchCachedText } from './docFetcher.js';

export interface DocEntry {
  title: string;
  url: string;
  description: string;
  product: string;
}

/**
 * Curated set of product llms.txt files to include in the search index.
 * Each file is fetched once and cached for the duration of the TTL.
 * Files are fetched in parallel on first search then served from cache.
 */
const INDEX_SOURCES: Array<{ url: string; product: string }> = [
  {
    url: 'https://docs.mapbox.com/api/llms.txt',
    product: 'API Reference'
  },
  {
    url: 'https://docs.mapbox.com/mapbox-gl-js/llms.txt',
    product: 'Mapbox GL JS'
  },
  {
    url: 'https://docs.mapbox.com/help/llms.txt',
    product: 'Help Center'
  },
  {
    url: 'https://docs.mapbox.com/style-spec/llms.txt',
    product: 'Style Specification'
  },
  {
    url: 'https://docs.mapbox.com/studio-manual/llms.txt',
    product: 'Studio Manual'
  },
  {
    url: 'https://docs.mapbox.com/mapbox-search-js/llms.txt',
    product: 'Mapbox Search JS'
  },
  {
    url: 'https://docs.mapbox.com/ios/maps/llms.txt',
    product: 'Maps SDK for iOS'
  },
  {
    url: 'https://docs.mapbox.com/android/maps/llms.txt',
    product: 'Maps SDK for Android'
  },
  {
    url: 'https://docs.mapbox.com/ios/navigation/llms.txt',
    product: 'Navigation SDK for iOS'
  },
  {
    url: 'https://docs.mapbox.com/android/navigation/llms.txt',
    product: 'Navigation SDK for Android'
  },
  {
    url: 'https://docs.mapbox.com/mapbox-tiling-service/llms.txt',
    product: 'Mapbox Tiling Service'
  },
  {
    url: 'https://docs.mapbox.com/data/tilesets/llms.txt',
    product: 'Tilesets'
  }
];

// Matches: - [Title](URL): optional description
// or:      - [Title](URL)
const ENTRY_RE = /^-\s+\[([^\]]+)\]\(([^)]+)\)(?::\s*(.+))?$/;

/**
 * Parse a product-level llms.txt file into searchable entries.
 * Each `- [Title](URL): description` line becomes one entry.
 * Lines that don't match (headers, blanks, root index links) are skipped.
 */
export function parseLlmsTxtEntries(
  content: string,
  product: string
): DocEntry[] {
  const entries: DocEntry[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    const match = ENTRY_RE.exec(line);
    if (!match) continue;
    const [, title, url, description = ''] = match;
    // Skip links to other llms.txt files (those are index links, not doc pages)
    if (url.endsWith('/llms.txt') || url.endsWith('/llms-full.txt')) continue;
    entries.push({ title, url, description, product });
  }
  return entries;
}

/**
 * Score an entry against the query words.
 * Title matches are weighted 3x, description and URL path matches 1x each.
 */
function scoreEntry(entry: DocEntry, queryWords: string[]): number {
  const titleLower = entry.title.toLowerCase();
  const descLower = entry.description.toLowerCase();
  const urlLower = entry.url.toLowerCase();

  let score = 0;
  for (const word of queryWords) {
    if (titleLower.includes(word)) score += 3;
    if (descLower.includes(word)) score += 1;
    if (urlLower.includes(word)) score += 1;
  }
  return score;
}

/**
 * Search across all indexed llms.txt files.
 *
 * All source files are fetched in parallel and cached via docCache.
 * First call may take ~500ms while files are fetched; subsequent calls
 * are instant since all content is in-memory.
 *
 * Failed sources are skipped gracefully so a single unavailable file
 * doesn't break the entire search.
 */
export async function searchDocs(
  query: string,
  limit: number,
  httpRequest: HttpRequest
): Promise<DocEntry[]> {
  const allEntries = (
    await Promise.all(
      INDEX_SOURCES.map(async ({ url, product }) => {
        try {
          const content = await fetchCachedText(url, httpRequest);
          return parseLlmsTxtEntries(content, product);
        } catch {
          return [];
        }
      })
    )
  ).flat();

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1); // skip single-char words

  const scored = allEntries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryWords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // Deduplicate by URL (same page can appear across multiple sources)
  const seen = new Set<string>();
  const results: DocEntry[] = [];
  for (const { entry } of scored) {
    if (!seen.has(entry.url)) {
      seen.add(entry.url);
      results.push(entry);
      if (results.length >= limit) break;
    }
  }

  return results;
}
