# Mapbox MCP Documentation Server

An MCP server providing AI assistants with access to Mapbox documentation and reference materials. No Mapbox access token required for most tools.

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
├── config/toolConfig.ts        # CLI argument parser (--enable-tools, --disable-tools)
├── constants/                  # Static data (API endpoint definitions, etc.)
├── resources/                  # MCP resource implementations
│   ├── BaseResource.ts         # Abstract base class for resources
│   ├── resourceRegistry.ts     # Resource registration
│   ├── utils/docParser.ts      # Shared doc parsing utilities
│   └── */                      # Individual resource implementations
├── tools/                      # MCP tool implementations
│   ├── BaseTool.ts             # Abstract base class for tools
│   ├── toolRegistry.ts         # Tool registration
│   └── */                      # Individual tool implementations
└── utils/
    ├── httpPipeline.ts         # HTTP pipeline with User-Agent, caching, retry
    ├── types.ts                # Shared types (HttpRequest, etc.)
    └── versionUtils.ts         # Version info

test/                           # Mirrors src/ structure
```

## Key Patterns

### Tool Architecture

All tools extend `BaseTool<InputSchema, OutputSchema>`:

```typescript
export class MyTool extends BaseTool<
  typeof MyInputSchema,
  typeof MyOutputSchema
> {
  readonly name = 'my_tool';
  readonly description = '...';
  readonly annotations = { title: 'My Tool', readOnlyHint: true, ... };

  constructor({ httpRequest }: { httpRequest: HttpRequest }) {
    super({ inputSchema: MyInputSchema, outputSchema: MyOutputSchema });
    this.httpRequest = httpRequest;
  }

  protected async execute(
    input: z.infer<typeof MyInputSchema>
  ): Promise<CallToolResult> {
    // no accessToken param — docs tools don't need one
  }
}
```

- `execute(input)` takes only the validated input — no `accessToken` or `context` params
- If a tool needs a token (e.g. `test_api_request_tool`), add it as a field in the input schema
- Register new tools in `src/tools/toolRegistry.ts` `CORE_TOOLS` array

### HTTP Pipeline

- **Never patch `global.fetch`** — always use the injected `httpRequest`
- The shared `httpRequest` from `httpPipeline.ts` adds User-Agent headers, 1-hour caching, and retry logic
- Pass `httpRequest` to tool/resource constructors for testability

### Resource Architecture

All resources extend `BaseResource`:

```typescript
export class MyResource extends BaseResource {
  readonly name = 'My Resource';
  readonly uri = 'resource://my-resource';
  readonly description = '...';
  readonly mimeType = 'text/markdown';

  public async readCallback(uri: URL, _extra): Promise<ReadResourceResult> {
    // fetch and return content
  }
}
```

Register in `src/resources/resourceRegistry.ts`.

## Essential Commands

```bash
npm install              # Install dependencies
npm test                 # Run tests (vitest)
npm run build            # Compile TypeScript (ESM + CJS via tshy)
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier check
npm run format:fix       # Prettier auto-fix
npm run inspect:build    # MCP Inspector against built server
npm run inspect:dev      # MCP Inspector against source (tsx, no build needed)
```

## Creating a New Tool

1. Create `src/tools/my-tool/MyTool.input.schema.ts` — Zod input schema
2. Create `src/tools/my-tool/MyTool.output.schema.ts` — Zod output schema (if using `structuredContent`)
3. Create `src/tools/my-tool/MyTool.ts` — extends `BaseTool`
4. Register in `src/tools/toolRegistry.ts`
5. Create `test/tools/my-tool/MyTool.test.ts` — mock all HTTP calls

## Pull Requests

- **Always update `CHANGELOG.md`** — add entry under `Unreleased` with PR number
- All tests must pass: `npm test`
- Lint and format must pass: `npm run lint && npm run format`

## Important Constraints

- **No global patching**: use `httpRequest` from the pipeline
- **Dependency injection**: tools and resources receive `httpRequest` in constructor
- **No real network calls in tests**: mock `httpRequest` with `vi.fn()`
- **Strict types**: avoid `any`
- **No access token env var**: docs tools are token-free; if a token is needed, it's an input field
