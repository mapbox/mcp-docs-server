# Contributing to Mapbox MCP Documentation Server

Thank you for your interest in contributing! Please read this guide before submitting a pull request.

## Getting Started

```bash
git clone https://github.com/mapbox/mcp-docs-server.git
cd mcp-docs-server
npm install
npm test
```

## Pull Requests

- Keep PRs small and focused on a single change
- **Always update `CHANGELOG.md`** — add your entry under the `Unreleased` section with a brief description and PR number
- All CI checks must pass before merging (lint, format, tests)
- At least one maintainer approval is required

## Code Standards

### TypeScript

- TypeScript only — no `.js` files in `src/` or `test/`
- Strict mode, avoid `any` (add a comment if absolutely necessary)
- All public classes, methods, and exported functions should have JSDoc comments

### HTTP Requests

- **Never patch `global.fetch`** — use the shared `httpRequest` from `src/utils/httpPipeline.ts`
- Pass `httpRequest` via dependency injection so tools are testable without network access

### Tools

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
    // implementation
  }
}
```

Register in `src/tools/toolRegistry.ts`.

### Resources

All resources extend `BaseResource`. Register in `src/resources/resourceRegistry.ts`.

### Testing

- Use Vitest, place tests in `test/` mirroring the `src/` structure
- Mock all HTTP calls — do not make real network requests in tests
- All new tools and resources must have tests

## File Structure

```
src/
├── constants/         # Static data (e.g. API endpoint definitions)
├── resources/         # MCP resource implementations
│   └── utils/         # Shared resource utilities (e.g. docParser)
├── tools/             # MCP tool implementations
└── utils/             # HTTP pipeline, types, version utils

test/                  # Mirrors src/ structure
```

## Security

- Never commit API keys, tokens, or secrets
- All documentation tools work without a Mapbox access token
- If a tool requires a token, accept it as an explicit input parameter (not an env variable)

## Changelog Format

Follow the existing format in `CHANGELOG.md`:

```markdown
## Unreleased

### Features Added

- **My Feature**: Description of what changed and why (#PR_NUMBER)
```
