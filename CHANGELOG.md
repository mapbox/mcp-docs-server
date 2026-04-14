## Unreleased

### Add `get_mapbox_docs_index_tool`

New tool that fetches the `llms.txt` documentation index for any Mapbox product directly — no manual resource attachment required. The model can autonomously discover and fetch the right index without user intervention.

- Supports 13 products: `api-reference`, `mapbox-gl-js`, `help-guides`, `style-spec`, `studio-manual`, `search-js`, `ios-maps`, `android-maps`, `ios-navigation`, `android-navigation`, `tiling-service`, `tilesets`, and `catalog` (root index)
- Results are cached via `docCache` — first fetch hits the network, subsequent calls are instant
- Complements `search_mapbox_docs_tool` (keyword search) and `get_document_tool` (full page fetch): use this when you know which product you need

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
