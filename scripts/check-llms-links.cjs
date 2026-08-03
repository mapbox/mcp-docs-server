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
 * Usage:
 *   node scripts/check-llms-links.cjs
 *   npm run check-llms-links
 */

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const ROOT_URL = 'https://docs.mapbox.com/llms.txt';
const LLMS_TXT_LINK_RE = /https:\/\/docs\.mapbox\.com\/[^\s)]*llms\.txt/g;
const REQUEST_TIMEOUT_MS = 15000;

function extractLlmsTxtUrls(text) {
  const matches = text.match(LLMS_TXT_LINK_RE) || [];
  return [...new Set(matches)].sort();
}

function readCuratedUrls() {
  const indexPath = path.join(process.cwd(), 'src/utils/docsSearchIndex.ts');
  if (!fs.existsSync(indexPath)) {
    return [];
  }
  const content = fs.readFileSync(indexPath, 'utf8');
  return extractLlmsTxtUrls(content);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { status: response.status, ok: response.ok, text };
  } catch (error) {
    return { status: null, ok: false, error: error.message };
  } finally {
    clearTimeout(timer);
  }
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

  const results = await Promise.all(
    allUrls.map(async (url) => ({ url, ...(await fetchWithTimeout(url)) }))
  );

  const failures = results.filter((r) => !r.ok);

  const statusLabel = (r) => (r.status !== null ? String(r.status) : `ERR`);
  const urlColumnWidth = Math.max(...allUrls.map((u) => u.length));
  for (const r of results) {
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

  if (failures.length > 0) {
    console.error(
      `✗ ${failures.length} of ${allUrls.length} llms.txt URL(s) failed:`
    );
    for (const f of failures) {
      console.error(`  - ${statusLabel(f)}  ${f.url}`);
    }
    process.exit(1);
  }

  console.log(`✓ All ${allUrls.length} llms.txt URL(s) returned 2xx`);
}

main();
