# Mapbox MCP Documentation Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI assistants instant access to Mapbox documentation and reference materials — **no Mapbox access token required**.

## Quick Start

### Hosted (no install required)

Connect directly to the hosted endpoint — nothing to install or maintain:

**Claude Code / Claude Desktop / Cursor / VS Code**

```json
{
  "mcpServers": {
    "mapbox-docs": {
      "url": "https://mcp-docs.mapbox.com/mcp"
    }
  }
}
```

---

### npx (runs locally, no install)

**Claude Code** — run `claude mcp add`:

```bash
claude mcp add mapbox-docs -- npx -y @mapbox/mcp-docs-server
```

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

**Cursor / VS Code** — add the same `mcpServers` block to your editor's MCP settings file.

---

### Docker

**Build the image:**

```bash
docker build -t mapbox/mcp-docs-server .
```

**Or pull from the registry:**

```bash
docker pull mapbox/mcp-docs-server
```

**Claude Desktop / Cursor / VS Code** — configure your MCP client to run the container:

```json
{
  "mcpServers": {
    "mapbox-docs": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "mapbox/mcp-docs-server"]
    }
  }
}
```

---

### Local (from source)

```bash
git clone https://github.com/mapbox/mcp-docs-server.git
cd mcp-docs-server
npm install
npm run build
```

**Claude Desktop / Cursor / VS Code:**

```json
{
  "mcpServers": {
    "mapbox-docs": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-docs-server/dist/esm/index.js"]
    }
  }
}
```

## Tools

**`get_document_tool`** — Fetches the full content of a specific Mapbox documentation page by URL. Use this to follow a link from a resource and retrieve the complete page content.

Example prompts:

- "What Mapbox APIs are available?"
- "How do I add a custom layer to a Mapbox style?"
- "What's the latest Mapbox GL JS version?"

**`batch_get_documents_tool`** — Fetches multiple Mapbox documentation pages in a single call (max 20). More efficient than calling `get_document_tool` multiple times. Failed pages include an error message rather than failing the whole batch.

**`search_docs_tool`** — Searches Mapbox documentation using Algolia full-text search and returns matching page URLs and excerpts. Use this to find relevant documentation before fetching full pages with `get_document_tool` or `batch_get_documents_tool`.

Example prompts:

- "Find docs about camera animation"
- "Search for geocoding API examples"
- "What documentation exists for custom layers?"

## Resources

MCP resources expose reference data that AI assistants can read on demand:

| Resource URI                           | Contents                                                            |
| -------------------------------------- | ------------------------------------------------------------------- |
| `resource://mapbox-api-reference`      | REST API reference docs (endpoints, parameters, rate limits)        |
| `resource://mapbox-sdk-docs`           | SDK and client library docs (iOS, Android, Flutter, web)            |
| `resource://mapbox-guides`             | Tutorials, how-tos, and guides                                      |
| `resource://mapbox-examples`           | Code examples, API playgrounds, and interactive demos               |
| `resource://mapbox-reference`          | Tilesets, data products, accounts, and pricing reference            |
| `resource://mapbox-style-layers`       | Style layer reference (paint/layout properties for all layer types) |
| `resource://mapbox-streets-v8-fields`  | Mapbox Streets v8 tileset field reference                           |
| `resource://mapbox-token-scopes`       | All available Mapbox token scopes with descriptions                 |
| `resource://mapbox-layer-type-mapping` | Mapping of Mapbox layer types to their properties                   |

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
