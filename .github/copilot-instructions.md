# GitHub Copilot Guidelines

This repository is the Mapbox MCP Documentation Server — a TypeScript MCP server providing AI assistants with Mapbox documentation and reference materials.

## Key Facts

- Tools extend `BaseTool` (not `MapboxApiBasedTool` — that class lives in a different repo)
- `BaseTool.execute(input)` takes **only the validated input** — no `accessToken` or `context` params
- No Mapbox access token is needed for most tools; if required, accept it as an input field
- HTTP requests use the shared `httpRequest` from `src/utils/httpPipeline.ts` — **never patch `global.fetch`**
- Tests mock `httpRequest` with `vi.fn()` — no real network calls in tests

## Before Accepting Suggestions

- Verify the suggestion uses `BaseTool`, not `MapboxApiBasedTool`
- Verify `execute(input)` has the correct signature (no extra params)
- Verify HTTP calls go through the injected `httpRequest`, not `fetch` directly
- Verify no secrets or tokens are hardcoded

## Standards

- TypeScript strict mode — no implicit `any`
- All new tools/resources need tests in `test/` mirroring the `src/` structure
- Update `CHANGELOG.md` under `Unreleased` with every user-facing change

See [CONTRIBUTING.md](../CONTRIBUTING.md) and [CLAUDE.md](../CLAUDE.md) for full patterns and examples.
