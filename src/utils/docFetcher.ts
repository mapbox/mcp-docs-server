// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { docCache, MAX_ENTRY_BYTES, readBodyWithLimit } from './docCache.js';
import type { HttpRequest } from './types.js';

const DOCS_HOSTNAME = 'docs.mapbox.com';

/**
 * Returns the effective docs hostname, allowing MAPBOX_DOCS_HOST_OVERRIDE
 * to redirect requests to a staging environment (e.g. docs.tilestream.net).
 */
function getDocsHostname(): string {
  return process.env.MAPBOX_DOCS_HOST_OVERRIDE ?? DOCS_HOSTNAME;
}

/**
 * Rewrite a docs.mapbox.com URL to its .md variant, substituting the
 * effective hostname (which may be overridden via MAPBOX_DOCS_HOST_OVERRIDE).
 * Returns null if the URL is not a docs.mapbox.com URL, or if the URL
 * already ends in a text extension (.md, .txt, .json) — those should be
 * fetched as-is without rewriting.
 *
 * Example (no override):
 *   https://docs.mapbox.com/accounts/guides  →  https://docs.mapbox.com/accounts/guides.md
 *   https://docs.mapbox.com/accounts/guides/ →  https://docs.mapbox.com/accounts/guides.md
 *   https://docs.mapbox.com/mapbox-gl-js/llms.txt → null (already a text file)
 *
 * Example (MAPBOX_DOCS_HOST_OVERRIDE=docs.tilestream.net):
 *   https://docs.mapbox.com/accounts/guides  →  https://docs.tilestream.net/accounts/guides.md
 */
export function toMarkdownUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== DOCS_HOSTNAME) return null;
    // Don't double-extend URLs that are already text/data files
    if (/\.(txt|md|json)$/i.test(parsed.pathname)) return null;
    parsed.hostname = getDocsHostname();
    parsed.pathname = parsed.pathname.replace(/\/$/, '') + '.md';
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Rewrite a docs.mapbox.com URL to use the effective hostname, for use
 * in the fallback fetch path when the .md variant is unavailable.
 */
function applyHostOverride(url: string): string {
  const override = process.env.MAPBOX_DOCS_HOST_OVERRIDE;
  if (!override) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === DOCS_HOSTNAME) {
      parsed.hostname = override;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Fetch a URL and cache the result, returning the cached version on
 * subsequent calls. Intended for fetching llms.txt index files which
 * change infrequently and are shared across multiple resources.
 */
export async function fetchCachedText(
  url: string,
  httpRequest: HttpRequest
): Promise<string> {
  const cached = docCache.get(url);
  if (cached) return cached;

  const response = await httpRequest(url, {});

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const content = await readBodyWithLimit(response, MAX_ENTRY_BYTES);
  docCache.set(url, content);
  return content;
}

/**
 * Fetch a Mapbox documentation page, preferring the .md variant for
 * docs.mapbox.com URLs when available. Falls back to the original URL
 * if the .md endpoint returns a non-2xx response.
 *
 * Set MAPBOX_DOCS_HOST_OVERRIDE=docs.tilestream.net to redirect all
 * docs.mapbox.com fetches to the staging environment.
 */
export async function fetchDocContent(
  url: string,
  httpRequest: HttpRequest
): Promise<string> {
  const mdUrl = toMarkdownUrl(url);

  if (mdUrl) {
    const mdResponse = await httpRequest(mdUrl, {});
    if (mdResponse.ok) {
      return readBodyWithLimit(mdResponse, MAX_ENTRY_BYTES);
    }
  }

  const fetchUrl = applyHostOverride(url);
  const response = await httpRequest(fetchUrl, {});

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return readBodyWithLimit(response, MAX_ENTRY_BYTES);
}
