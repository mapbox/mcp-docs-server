# AI Agent Instructions for Mapbox MCP Documentation Server

> **Note**: If you're using Claude Code specifically, see [CLAUDE.md](./CLAUDE.md) instead. This file is for general AI coding assistants (Cursor, Continue, Aider, Copilot, etc.).

## What This Project Does

This is an MCP (Model Context Protocol) server that gives AI assistants access to Mapbox documentation and reference materials. **No Mapbox access token is required** for most tools — it is a documentation-only server.

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript (strict mode)
- **Build**: `tshy` (dual ESM/CJS output)
- **Testing**: Vitest
- **Package Manager**: npm

## Project Structure

```
src/
├── index.ts                    # MCP server entry point
├── config/toolConfig.ts        # CLI argument parser
├── constants/                  # Static data (API endpoint definitions)
├── resources/                  # MCP resource implementations
│   ├── BaseResource.ts         # Abstract base class
│   ├── resourceRegistry.ts     # Resource registration
│   ├── utils/docParser.ts      # Shared doc parsing utilities
│   └── */                      # Individual resource implementations
├── tools/                      # MCP tool implementations
│   ├── BaseTool.ts             # Abstract base class
│   ├── toolRegistry.ts         # Tool registration
│   └── */                      # Individual tool implementations
└── utils/
    ├── httpPipeline.ts         # HTTP pipeline (User-Agent, caching, retry)
    ├── types.ts                # Shared types
    └── versionUtils.ts

test/                           # Mirrors src/ structure
```

## Critical Patterns

### Tool Architecture

- All tools extend `BaseTool<InputSchema, OutputSchema>` (not `MapboxApiBasedTool` — that is in a different repo)
- `execute(input)` receives only the validated input — **no `accessToken` or `context` parameters**
- If a tool needs a Mapbox token, it must be a field in the input schema
- Register tools in `src/tools/toolRegistry.ts`

```typescript
export class MyTool extends BaseTool<typeof MyInputSchema> {
  readonly name = 'my_tool';

  constructor({ httpRequest }: { httpRequest: HttpRequest }) {
    super({ inputSchema: MyInputSchema });
    this.httpRequest = httpRequest;
  }

  protected async execute(
    input: z.infer<typeof MyInputSchema>
  ): Promise<CallToolResult> { ... }
}
```

### HTTP Requests

- **Never patch `global.fetch`** — use the injected `httpRequest` function
- Pass `httpRequest` via constructor so tools can be tested without network access
- The shared `httpRequest` from `src/utils/httpPipeline.ts` adds User-Agent, 1-hour caching, and retry

### Testing

- Use Vitest exclusively
- Mock all HTTP calls — no real network requests in tests
- Place tests in `test/` mirroring the `src/` structure

## Essential Commands

```bash
npm install              # Install dependencies
npm test                 # Run tests
npm run build            # Compile TypeScript
npm run lint             # ESLint
npm run format           # Prettier check
npm run inspect:build    # Test with MCP Inspector
```

## Common Pitfalls

1. **Don't use `MapboxApiBasedTool`** — it doesn't exist here, use `BaseTool`
2. **Don't patch `global.fetch`** — use the `httpRequest` pipeline
3. **Don't make real network calls in tests** — mock `httpRequest` with a stub
4. **Don't read the access token from an env variable** — accept it as an input field if needed
5. **Don't commit without updating `CHANGELOG.md`** — add an entry under `Unreleased`

## Pull Requests

- Update `CHANGELOG.md` under the `Unreleased` section
- All tests must pass: `npm test`
- Lint and format must pass: `npm run lint && npm run format`

## Further Reading

- [CLAUDE.md](./CLAUDE.md) — detailed patterns and architecture
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution standards and code examples
