## Unreleased

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
