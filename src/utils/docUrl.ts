// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

const DOCS_HOSTNAME = 'docs.mapbox.com';

// Only documentation hosts are allowed. Bare mapbox.com and api.mapbox.com are
// intentionally excluded: neither is a documentation host, and api.mapbox.com
// is an authenticated API.
function allowedHostnames(): Set<string> {
  const hosts = new Set([DOCS_HOSTNAME]);
  const override = process.env.MAPBOX_DOCS_HOST_OVERRIDE;
  if (override) hosts.add(override);
  return hosts;
}

/**
 * True only for plain https URLs on an allowed documentation host, with no
 * explicit port and no embedded credentials.
 */
export function isDocsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.port === '' &&
      parsed.username === '' &&
      parsed.password === '' &&
      allowedHostnames().has(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function hasAccessToken(url: string): boolean {
  try {
    for (const key of new URL(url).searchParams.keys()) {
      if (key.toLowerCase() === 'access_token') return true;
    }
    return false;
  } catch {
    return false;
  }
}
