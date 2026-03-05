# Mapbox MCP Documentation Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI assistants instant access to Mapbox documentation and reference materials — **no Mapbox access token required**.

## Quick Start

### Claude Code

```json
{
  "mcpServers": {
    "mapbox-docs": {
      "command": "npx",
      "args": ["-y", "@mapbox/mcp-docs-server"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mapbox-docs": {
      "command": "npx",
      "args": ["-y", "@mapbox/mcp-docs-server"]
    }
  }
}
```

### Cursor / VS Code

Add the same `mcpServers` block to your editor's MCP settings file.

## Tools

### Documentation Tools

**`get_latest_mapbox_docs_tool`** — Fetches the full Mapbox documentation index from `docs.mapbox.com/llms.txt`. Returns up-to-date, comprehensive coverage of all Mapbox services, APIs, SDKs, and guides in a single LLM-optimized format.

Example prompts:

- "What Mapbox APIs are available?"
- "How do I add a custom layer to a Mapbox style?"
- "What's the latest Mapbox GL JS version?"

**`search_mapbox_docs_tool`** _(coming soon)_ — AI-powered search of Mapbox documentation. Returns ranked, relevant sections for a specific query instead of the full corpus. Supports filtering by category (apis, sdks, guides, examples).

**`explore_mapbox_api_tool`** _(coming soon)_ — Structured, queryable information about Mapbox REST API endpoints. Lists available APIs, operations, required parameters, authentication scopes, and rate limits without making any API calls.

**`validate_api_request_tool`** _(coming soon)_ — Validates a Mapbox API request before sending it. Checks required parameters, types, enum values, and token scopes.

**`test_api_request_tool`** _(coming soon)_ — Makes real HTTP calls to Mapbox APIs and returns actual responses, with optional code generation in curl, JavaScript, and Python. Requires a Mapbox access token as input.

**`get_contextual_docs_tool`** _(coming soon)_ — Retrieves documentation relevant to a specific code context, error message, or technology.

### Reference Tools

**`get_reference_tool`** — Serves static Mapbox reference documentation directly as tool output (useful for clients that don't support MCP resources). Covers style layers, Streets v8 fields, token scopes, and layer type mappings.

## Resources

MCP resources expose reference data that AI assistants can read on demand:

| Resource URI                                      | Contents                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `resource://mapbox-documentation`                 | Full Mapbox docs from `docs.mapbox.com/llms.txt`                    |
| `resource://mapbox-api-reference` _(coming soon)_ | REST API reference docs only                                        |
| `resource://mapbox-sdk-docs` _(coming soon)_      | SDK and client library docs only                                    |
| `resource://mapbox-guides` _(coming soon)_        | Tutorials, how-tos, and guides only                                 |
| `resource://mapbox-examples` _(coming soon)_      | Code examples and playgrounds only                                  |
| `resource://mapbox-reference` _(coming soon)_     | Tilesets, data products, and reference materials                    |
| `resource://mapbox-style-layers`                  | Style layer reference (paint/layout properties for all layer types) |
| `resource://mapbox-streets-v8-fields`             | Mapbox Streets v8 tileset field reference                           |
| `resource://mapbox-token-scopes`                  | All available Mapbox token scopes with descriptions                 |
| `resource://mapbox-layer-type-mapping`            | Mapping of Mapbox layer types to their properties                   |

## Development

### Prerequisites

- Node.js >= 22
- npm

### Setup

```bash
git clone https://github.com/mapbox/mcp-docs-server.git
cd mcp-docs-server
npm install
```

### Commands

```bash
npm run build          # Compile TypeScript (ESM + CJS)
npm test               # Run test suite (vitest)
npm run lint           # ESLint
npm run format         # Prettier check
npm run format:fix     # Prettier auto-fix
npm run inspect:build  # Launch MCP Inspector against built server
npm run inspect:dev    # Launch MCP Inspector against source (tsx)
```

### Architecture

The server is a TypeScript MCP server using `@modelcontextprotocol/sdk` with a dual ESM/CJS build via `tshy`.

- **Tools** extend `BaseTool<InputSchema, OutputSchema>` in `src/tools/`
- **Resources** extend `BaseResource` in `src/resources/`
- No Mapbox access token required for documentation tools
- HTTP requests use a shared `httpPipeline` with 1-hour caching

### Creating a New Tool

1. Create a directory `src/tools/my-tool/`
2. Add `MyTool.input.schema.ts` (Zod schema), `MyTool.output.schema.ts`, and `MyTool.ts` (extends `BaseTool`)
3. Register in `src/tools/toolRegistry.ts`
4. Add tests in `test/tools/my-tool/`

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and [VISION.md](./VISION.md) before submitting a pull request. Contributors using AI coding assistants should also review:

- [CLAUDE.md](./CLAUDE.md) — for Claude Code
- [AGENTS.md](./AGENTS.md) — for other AI coding assistants (Cursor, Copilot, Aider, etc.)

## License

MIT — see [LICENSE](./LICENSE)
