## Unreleased

### Resources — use sublevel `llms.txt` per product

docs.mapbox.com restructured its documentation so that `llms.txt` files now exist at every product level (e.g. `docs.mapbox.com/api/llms.txt`, `docs.mapbox.com/help/llms.txt`, `docs.mapbox.com/mapbox-gl-js/llms.txt`) alongside `llms-full.txt` files containing full page content. The root `docs.mapbox.com/llms.txt` is now a pure index of links to these sublevel files rather than a monolithic content file. The previous resources all filtered the root file by category keyword — now that the root contains only link lists, they were effectively returning empty or useless content.

Updated resources to use the appropriate sublevel `llms.txt` files:

- **`resource://mapbox-api-reference`** now fetches `docs.mapbox.com/api/llms.txt` — a clean, structured index of every Mapbox REST API grouped by service (Maps, Navigation, Search, Accounts) with links to full API reference pages
- **`resource://mapbox-guides`** now fetches `docs.mapbox.com/help/llms.txt` (39KB) — the full Mapbox Help Center index with troubleshooting guides, how-to tutorials, and walkthroughs
- **`resource://mapbox-sdk-docs`** now fetches `docs.mapbox.com/mapbox-gl-js/llms.txt` (34KB) — the GL JS documentation index listing all guides, API reference pages, and examples for the primary web mapping SDK
- **`resource://mapbox-reference`** now fetches the root `llms.txt` without filtering and returns the complete product catalog — useful for discovering what documentation exists and finding `llms.txt` URLs for any product
- **`resource://mapbox-examples`** continues to extract playground/demo/example sections from the root index (API Playgrounds, Demos & Projects)

**`docFetcher.fetchCachedText`** — new shared helper that fetches a URL and stores it in `docCache`, used by all five resources to avoid duplicating the fetch+cache pattern.

**`docFetcher.toMarkdownUrl`** — no longer rewrites URLs already ending in `.txt`, `.md`, or `.json`. Previously `get_document_tool` would try to fetch `llms.txt.md` before falling back; now it fetches `llms.txt` directly on the first attempt.

### Replace Algolia search with self-contained llms.txt search

`search_mapbox_docs_tool` no longer depends on the Algolia third-party service. The hosted server shares a single Algolia free-tier quota across all users, making it prone to throttling as usage grows. The new implementation searches directly against the `llms.txt` index files that now exist at every product level on docs.mapbox.com.

**How it works:**

On first search, the tool fetches 12 product `llms.txt` files in parallel (~220KB total). Each file contains a structured list of documentation pages with titles, URLs, and one-line descriptions. These files are cached for the standard 1-hour TTL, so subsequent searches are pure in-memory keyword matching — no network calls.

**Products indexed:**

- API Reference (`api/llms.txt`)
- Mapbox GL JS (`mapbox-gl-js/llms.txt`)
- Help Center (`help/llms.txt`)
- Style Specification (`style-spec/llms.txt`)
- Studio Manual (`studio-manual/llms.txt`)
- Mapbox Search JS (`mapbox-search-js/llms.txt`)
- Maps SDK for iOS and Android
- Navigation SDK for iOS and Android
- Mapbox Tiling Service
- Tilesets

**Scoring:** Title matches (3×) outrank description matches (1×) and URL path matches (1×). Results are deduplicated by URL across sources and capped at the requested `limit`.

**Reliability:** Failed sources are silently skipped — if any single product `llms.txt` is unreachable, the remaining sources still return results.

**`fetchCachedText(url, httpRequest)`** — new helper in `docFetcher.ts` that fetches a URL and stores the response in `docCache`. Used by `docsSearchIndex.ts` to share the cache with the resource layer (which also caches `llms.txt` files). Fixed a subtle bug where empty-string responses (`''`) were not treated as cache hits due to falsy check — now uses `!== null`.

### Raise `docCache` per-entry limit to 5 MB with size warnings

- **Hard cap raised from 2 MB → 5 MB** — allows `llms-full.txt` files (Style Spec 466 KB, iOS Nav 696 KB, GL JS 1.6 MB) to be cached after being fetched via `get_document_tool`
- **Warning at 1 MB** — `console.warn` when an entry between 1 MB and 5 MB is cached, so operators can see large entries in server logs
- **Warning on rejection** — entries exceeding the 5 MB cap now log `[docCache] Entry too large to cache` instead of being silently dropped

### Dependencies

- **Upgrade `tshy` to `^4.1.1`, `vitest` to `^4.1.4`, `typescript` to `^6.0.2`** — removed deprecated `baseUrl` from `tsconfig.base.json` (TS6), added `"types": ["node"]` (required because tshy compiles from `.tshy/` and does not auto-discover `@types/node` in CI); downgraded `@types/node` to `^22.0.0` for LTS consistency with other repos; bumped `typescript-eslint` packages to `^8.58.2` for TypeScript 6 support

### Resources — use sublevel `llms.txt` per product

docs.mapbox.com restructured its documentation so that `llms.txt` files now exist at every product level (e.g. `docs.mapbox.com/api/llms.txt`, `docs.mapbox.com/help/llms.txt`, `docs.mapbox.com/mapbox-gl-js/llms.txt`) alongside `llms-full.txt` files containing full page content. The root `docs.mapbox.com/llms.txt` is now a pure index of links to these sublevel files rather than a monolithic content file. The previous resources all filtered the root file by category keyword — now that the root contains only link lists, they were effectively returning empty or useless content.

Updated resources to use the appropriate sublevel `llms.txt` files:

- **`resource://mapbox-api-reference`** now fetches `docs.mapbox.com/api/llms.txt` — a clean, structured index of every Mapbox REST API grouped by service (Maps, Navigation, Search, Accounts) with links to full API reference pages
- **`resource://mapbox-guides`** now fetches `docs.mapbox.com/help/llms.txt` (39KB) — the full Mapbox Help Center index with troubleshooting guides, how-to tutorials, and walkthroughs
- **`resource://mapbox-sdk-docs`** now fetches `docs.mapbox.com/mapbox-gl-js/llms.txt` (34KB) — the GL JS documentation index listing all guides, API reference pages, and examples for the primary web mapping SDK
- **`resource://mapbox-reference`** now fetches the root `llms.txt` without filtering and returns the complete product catalog — useful for discovering what documentation exists and finding `llms.txt` URLs for any product
- **`resource://mapbox-examples`** continues to extract playground/demo/example sections from the root index (API Playgrounds, Demos & Projects)

**`docFetcher.fetchCachedText`** — new shared helper that fetches a URL and stores it in `docCache`, used by all five resources to avoid duplicating the fetch+cache pattern.

**`docFetcher.toMarkdownUrl`** — no longer rewrites URLs already ending in `.txt`, `.md`, or `.json`. Previously `get_document_tool` would try to fetch `llms.txt.md` before falling back; now it fetches `llms.txt` directly on the first attempt.

## 0.2.1 - 2026-04-01

### Security

- **CVE-2026-4926**: Upgraded `@modelcontextprotocol/sdk` to `^1.29.0`, resolving `path-to-regexp` to `8.4.1` and fixing the ReDoS vulnerability [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f)

## 0.2.0 - 2026-04-01

### Add `search_mapbox_docs_tool`

- New `search_mapbox_docs_tool` searches all Mapbox documentation via the Algolia index powering docs.mapbox.com
- Returns ranked results with titles, URLs, and content excerpts — use `get_document_tool` to fetch the full page content
- Supports 1–20 results per query (default 5)

## 0.1.2 - 2026-03-18

## 0.1.1 - 2026-03-18

## 0.1.0 - 2026-03-18

## 0.1.0 - 2026-03-18

### Add hosted deployment at mcp-docs.mapbox.com

- `@mapbox/mcp-docs-server` is now available as a hosted MCP endpoint at `https://mcp-docs.mapbox.com/mcp` — no install or token required
- Connect directly from Claude Code, Claude Desktop, Cursor, or VS Code using the `url` field in your MCP config

### Update README: correct tool names and resources table (#9)

- Replaced stale tool name references with `get_document_tool` and `batch_get_documents_tool`
- Removed "coming soon" markers from all resources in the resources table
- Dropped deprecated `resource://mapbox-documentation` entry

### Add Claude automated code review workflow (#6)

- Added `.github/workflows/claude-review.yml` using `anthropics/claude-code-action@v1`
- Triggers automatically on PRs with ≥ 300 lines changed, or on any PR when a reviewer comments `@claude`

### Add sub-path exports for tools, resources, and utils (#7)

- Added barrel files `src/tools/index.ts`, `src/resources/index.ts`, and `src/utils/index.ts`
- Exposed `./tools`, `./resources`, and `./utils` sub-path exports via `tshy` and the `exports` map in `package.json`
- Enables hosted-mcp-server and other consumers to import server internals directly without bundling the full entry point

### Fix transient memory amplification in `batch_get_documents_tool` (#4)

- Deduplicate intra-batch URLs by normalized key: multiple input URLs that resolve to the same page (e.g. cache-busting query params) now share a single HTTP request and a single buffered body instead of each triggering a separate fetch
- Add streaming response body size cap via `readBodyWithLimit`: aborts reads that exceed 2 MB before the full body is buffered; also rejects on `Content-Length` before reading begins
- Apply the same body size cap to `get_document_tool`

### Fix unbounded cache growth in `DocCache` (#2)

- Added a 512-entry LRU eviction limit to prevent unbounded Map growth
- Added a 2 MB per-entry cap — oversized responses are not cached
- Added a 50 MB total cache size cap with oldest-first eviction
- Normalized cache keys by stripping query parameters and hash fragments, preventing cache-busting query strings from inflating the entry count
- Added 22 unit tests covering all new cache invariants

### Scaffold

- MCP documentation server forked from `mcp-devkit-server`, retaining only documentation-related tools and resources
- **No API token required**: All tools work without a Mapbox access token
- Dual ESM/CJS build via `tshy`
- TypeScript with strict mode, ESLint, Prettier, Husky + lint-staged
- Vitest test suite with `passWithNoTests`
- GitHub Actions CI workflow
