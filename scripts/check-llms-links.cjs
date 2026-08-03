#!/usr/bin/env node
// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

/**
 * Checks every llms.txt file exposed by docs.mapbox.com for broken links.
 *
 * Discovers the full set of product llms.txt URLs by:
 * 1. Fetching the root https://docs.mapbox.com/llms.txt index
 * 2. Extracting every linked *.../llms.txt URL from it
 * 3. Cross-checking against the curated list in src/utils/docsSearchIndex.ts,
 *    flagging any curated URL that the live root index no longer links to
 *    (a sign docsSearchIndex.ts has drifted from docs.mapbox.com)
 *
 * Every discovered URL (root + linked + curated) is then requested and its
 * HTTP status recorded. Exits non-zero if any URL does not return 2xx.
 *
 * Pass --deep to additionally crawl every docs.mapbox.com page linked from
 * those llms.txt files (hundreds to low-thousands of URLs) — this catches
 * broken sub-links proactively, rather than waiting for a customer to hit
 * one through the MCP server.
 *
 * Usage:
 *   node scripts/check-llms-links.cjs
 *   node scripts/check-llms-links.cjs --deep
 *   npm run check-llms-links
 *   npm run check-llms-links:deep
 */

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const ROOT_URL = 'https://docs.mapbox.com/llms.txt';
const LLMS_TXT_LINK_RE = /https:\/\/docs\.mapbox\.com\/[^\s)]*llms\.txt/g;
const MARKDOWN_LINK_RE = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const REQUEST_TIMEOUT_MS = 15000;
const SUBLINK_TIMEOUT_MS = 10000;
const SUBLINK_CONCURRENCY = 10;
const SUBLINK_HOSTNAME = 'docs.mapbox.com';

const deep = process.argv.includes('--deep');

function extractLlmsTxtUrls(text) {
  const matches = text.match(LLMS_TXT_LINK_RE) || [];
  return [...new Set(matches)].sort();
}

function extractMarkdownLinks(text) {
  const urls = [];
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    urls.push(match[1]);
  }
  return urls;
}

function readCuratedUrls() {
  const indexPath = path.join(process.cwd(), 'src/utils/docsSearchIndex.ts');
  if (!fs.existsSync(indexPath)) {
    return [];
  }
  const content = fs.readFileSync(indexPath, 'utf8');
  return extractLlmsTxtUrls(content);
}

async function fetchWithTimeout(
  url,
  { method = 'GET', timeoutMs = REQUEST_TIMEOUT_MS } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, signal: controller.signal });
    const text = method === 'GET' ? await response.text() : '';
    return { status: response.status, ok: response.ok, text };
  } catch (error) {
    return { status: null, ok: false, error: error.message, text: '' };
  } finally {
    clearTimeout(timer);
  }
}

// Prefers a cheap HEAD request; falls back to GET when a server doesn't
// support HEAD (some static hosts return 405/501, or drop the connection).
async function checkLink(url) {
  const head = await fetchWithTimeout(url, {
    method: 'HEAD',
    timeoutMs: SUBLINK_TIMEOUT_MS
  });
  if (head.status === 405 || head.status === 501 || head.status === null) {
    return fetchWithTimeout(url, {
      method: 'GET',
      timeoutMs: SUBLINK_TIMEOUT_MS
    });
  }
  return head;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runNext() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext)
  );
  return results;
}

async function main() {
  console.log(`Fetching root index: ${ROOT_URL}`);
  const rootResult = await fetchWithTimeout(ROOT_URL);
  if (!rootResult.ok) {
    console.error(
      `Error: could not fetch root llms.txt (status: ${rootResult.status ?? 'n/a'}${
        rootResult.error ? `, ${rootResult.error}` : ''
      })`
    );
    process.exit(1);
  }

  const linkedUrls = extractLlmsTxtUrls(rootResult.text);
  const curatedUrls = readCuratedUrls();

  const allUrls = [
    ...new Set([ROOT_URL, ...linkedUrls, ...curatedUrls])
  ].sort();

  const staleCurated = curatedUrls.filter(
    (url) => !linkedUrls.includes(url) && url !== ROOT_URL
  );

  console.log(
    `Discovered ${allUrls.length} llms.txt URL(s) (${linkedUrls.length} linked from root, ${curatedUrls.length} curated in docsSearchIndex.ts)\n`
  );

  const indexResults = await Promise.all(
    allUrls.map(async (url) =>
      url === ROOT_URL
        ? { url, ...rootResult }
        : { url, ...(await fetchWithTimeout(url)) }
    )
  );

  const indexFailures = indexResults.filter((r) => !r.ok);

  const statusLabel = (r) => (r.status !== null ? String(r.status) : `ERR`);
  const urlColumnWidth = Math.max(...allUrls.map((u) => u.length));
  for (const r of indexResults) {
    const marker = r.ok ? ' ' : '✗';
    console.log(
      `${marker} ${statusLabel(r).padEnd(4)} ${r.url.padEnd(urlColumnWidth)}${
        r.error ? `  (${r.error})` : ''
      }`
    );
  }

  console.log('');
  if (staleCurated.length > 0) {
    console.log(
      `Note: docsSearchIndex.ts references ${staleCurated.length} llms.txt URL(s) no longer linked from the root index (may have moved/renamed):`
    );
    for (const url of staleCurated) {
      console.log(`  - ${url}`);
    }
    console.log('');
  }

  if (indexFailures.length > 0) {
    console.error(
      `✗ ${indexFailures.length} of ${allUrls.length} llms.txt URL(s) failed:`
    );
    for (const f of indexFailures) {
      console.error(`  - ${statusLabel(f)}  ${f.url}`);
    }
  } else {
    console.log(`✓ All ${allUrls.length} llms.txt URL(s) returned 2xx`);
  }

  if (!deep) {
    if (indexFailures.length > 0) process.exit(1);
    return;
  }

  console.log(
    `\nDeep mode: crawling ${SUBLINK_HOSTNAME} sub-links referenced in each llms.txt file...\n`
  );

  const sourcesByUrl = new Map();
  for (const result of indexResults) {
    if (!result.ok || !result.text) continue;
    for (const link of extractMarkdownLinks(result.text)) {
      let hostname;
      try {
        hostname = new URL(link).hostname;
      } catch {
        continue;
      }
      if (hostname !== SUBLINK_HOSTNAME) continue;
      if (allUrls.includes(link)) continue; // already checked above as an index file
      if (!sourcesByUrl.has(link)) sourcesByUrl.set(link, new Set());
      sourcesByUrl.get(link).add(result.url);
    }
  }

  const subLinks = [...sourcesByUrl.keys()].sort();
  console.log(
    `Discovered ${subLinks.length} unique ${SUBLINK_HOSTNAME} sub-link(s)\n`
  );

  const subResults = await runWithConcurrency(
    subLinks,
    SUBLINK_CONCURRENCY,
    async (url) => ({ url, ...(await checkLink(url)) })
  );

  const subFailures = subResults.filter((r) => !r.ok);

  if (subFailures.length > 0) {
    console.error(
      `✗ ${subFailures.length} of ${subLinks.length} sub-link(s) failed:`
    );
    for (const f of subFailures) {
      const sources = [...sourcesByUrl.get(f.url)].join(', ');
      console.error(`  - ${statusLabel(f)}  ${f.url}`);
      console.error(`      linked from: ${sources}`);
    }
  } else {
    console.log(`✓ All ${subLinks.length} sub-link(s) returned 2xx`);
  }

  if (indexFailures.length > 0 || subFailures.length > 0) {
    process.exit(1);
  }
}

main();
