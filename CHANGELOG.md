## Unreleased

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
