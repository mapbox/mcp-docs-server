// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { docCache, MAX_ENTRY_BYTES, readBodyWithLimit } from './docCache.js';
import { hasAccessToken, isDocsUrl } from './docUrl.js';
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
 * docs.mapbox.com serves HTML pages at a trailing-slash path and answers the
 * slash-less form with a redirect. Add the slash to extension-less paths so
 * the fallback fetch gets the page directly.
 */
function withTrailingSlash(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== getDocsHostname()) return url;
    const lastSegment = parsed.pathname.split('/').pop() ?? '';
    if (lastSegment !== '' && !lastSegment.includes('.')) {
      parsed.pathname += '/';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const MAX_REDIRECTS = 3;
const FOLLOWED_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class RedirectError extends Error {}

/**
 * Resolve the Location of a redirect response against the URL that was
 * requested. Returns null unless the status is one we follow and the target is
 * a different, allowed documentation URL without an access_token.
 */
function redirectTarget(response: Response, current: string): string | null {
  if (!FOLLOWED_REDIRECT_STATUSES.has(response.status)) return null;
  const location = response.headers.get('location');
  if (!location?.trim()) return null;
  try {
    const next = new URL(location, current).href;
    if (next === new URL(current).href) return null;
    if (!isDocsUrl(next) || hasAccessToken(next)) return null;
    return next;
  } catch {
    return null;
  }
}

/**
 * Map a URL on the effective docs host back to docs.mapbox.com. Needed because
 * toMarkdownUrl only matches docs.mapbox.com and applies the host override
 * itself.
 */
function toCanonicalDocsUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === getDocsHostname()) {
      parsed.hostname = DOCS_HOSTNAME;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * GET a URL, following up to MAX_REDIRECTS redirects. Every hop is validated
 * with isDocsUrl() before it is requested, so a redirect can only lead to
 * another documentation URL. Throws RedirectError otherwise.
 *
 * `beforeFollow` is called with each validated hop before it is requested. If
 * it returns content, that content is returned and the hop is not requested.
 */
async function fetchFollowingDocsRedirects(
  url: string,
  httpRequest: HttpRequest
): Promise<{ response: Response; finalUrl: string }>;
async function fetchFollowingDocsRedirects(
  url: string,
  httpRequest: HttpRequest,
  beforeFollow: (next: string) => Promise<string | null>
): Promise<{ response: Response; finalUrl: string } | { content: string }>;
async function fetchFollowingDocsRedirects(
  url: string,
  httpRequest: HttpRequest,
  beforeFollow?: (next: string) => Promise<string | null>
): Promise<{ response: Response; finalUrl: string } | { content: string }> {
  let current = url;
  for (let hops = 0; ; hops++) {
    const response = await httpRequest(current, {});
    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current };
    }
    void response.body?.cancel();
    if (hops >= MAX_REDIRECTS) throw new RedirectError('Too many redirects');
    const next = redirectTarget(response, current);
    if (next === null) {
      throw new RedirectError(`${response.status} Redirect not followed`);
    }
    const early = await beforeFollow?.(next);
    if (early != null) return { content: early };
    current = next;
  }
}

/**
 * Fetch a URL and cache the result. Intended for fetching llms.txt index
 * files which are small, change infrequently, and are shared across multiple
 * resources and tool calls.
 */
export async function fetchCachedText(
  url: string,
  httpRequest: HttpRequest
): Promise<string> {
  const cached = docCache.get(url);
  if (cached !== null) return cached;

  const { response, finalUrl } = await fetchFollowingDocsRedirects(
    url,
    httpRequest
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  // A redirected index must still be text, not the HTML page it moved to.
  if (
    finalUrl !== url &&
    response.headers.get('content-type')?.toLowerCase().includes('text/html')
  ) {
    void response.body?.cancel();
    throw new Error(`Unexpected content type for ${url}`);
  }

  const content = await response.text();
  if (Buffer.byteLength(content, 'utf8') > MAX_ENTRY_BYTES) {
    throw new Error(`Response too large for ${url}`);
  }
  docCache.set(url, content);
  return content;
}

/**
 * Fetch a Mapbox documentation page, preferring the .md variant for
 * docs.mapbox.com URLs when available. Falls back to the original URL
 * if the .md endpoint returns a non-2xx response. Redirects are followed only
 * to other allowed documentation URLs (e.g. a page that has moved); if the
 * fallback ends up on a different URL, its .md variant is tried first.
 *
 * Set MAPBOX_DOCS_HOST_OVERRIDE=docs.tilestream.net to redirect all
 * docs.mapbox.com fetches to the staging environment.
 */
export async function fetchDocContent(
  url: string,
  httpRequest: HttpRequest
): Promise<string> {
  const tryMarkdown = async (mdUrl: string): Promise<string | null> => {
    try {
      const result = await fetchFollowingDocsRedirects(mdUrl, httpRequest);
      if (result.response.ok) {
        return await readBodyWithLimit(result.response, MAX_ENTRY_BYTES);
      }
      void result.response.body?.cancel();
    } catch (error) {
      if (!(error instanceof RedirectError)) throw error;
    }
    return null;
  };

  const mdUrl = toMarkdownUrl(url);
  if (mdUrl) {
    const markdown = await tryMarkdown(mdUrl);
    if (markdown !== null) return markdown;
  }

  // For a moved page, try the .md variant of the new location before
  // requesting its HTML. `next` has already passed isDocsUrl(); the derived
  // .md URL is checked again before it is requested. A single request, no
  // redirects: keeps the total request count bounded by MAX_REDIRECTS.
  const probed = new Set<string>(mdUrl ? [mdUrl] : []);
  const tryMovedMarkdown = async (next: string): Promise<string | null> => {
    const movedMdUrl = toMarkdownUrl(toCanonicalDocsUrl(next));
    if (!movedMdUrl || !isDocsUrl(movedMdUrl) || hasAccessToken(movedMdUrl)) {
      return null;
    }
    if (probed.has(movedMdUrl)) return null;
    probed.add(movedMdUrl);
    const response = await httpRequest(movedMdUrl, {});
    if (response.ok) return readBodyWithLimit(response, MAX_ENTRY_BYTES);
    void response.body?.cancel();
    return null;
  };

  const fetchUrl = withTrailingSlash(applyHostOverride(url));
  const result = await fetchFollowingDocsRedirects(
    fetchUrl,
    httpRequest,
    tryMovedMarkdown
  );
  if ('content' in result) return result.content;

  const { response } = result;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return readBodyWithLimit(response, MAX_ENTRY_BYTES);
}
