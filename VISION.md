# Vision: Mapbox MCP Documentation Server

## The Problem

AI coding assistants have a training data cutoff. Mapbox ships new SDKs, changes API parameters, deprecates endpoints, and releases new features continuously. By the time a developer asks their AI assistant how to use a Mapbox API, the answer may already be wrong — referencing deprecated methods, outdated syntax, or APIs that no longer exist.

This isn't a failure of the AI model. It's a structural problem: training data ages, and no amount of fine-tuning keeps pace with a fast-moving platform.

## The Insight

Instead of hoping Mapbox is well-represented in training data — which we can't control and which becomes stale the moment it's captured — we can inject authoritative, always-current Mapbox documentation directly into the AI's context at inference time.

When the agent reaches for Mapbox knowledge, it gets the real thing: the same documentation developers read on docs.mapbox.com, fetched live, formatted for LLMs.

Google built this for their own products with the [Developer Knowledge API](https://developers.googleblog.com/introducing-the-developer-knowledge-api-and-mcp-server/). This server is Mapbox's equivalent.

## Competitive Landscape

Third-party services like [Context7](https://context7.com/websites/mapbox) crawl and index Mapbox documentation and serve it to AI assistants. Context7 has indexed 2,218 Mapbox pages with 10,582 code snippets.

We don't compete on crawling or indexing. We differentiate on three things they cannot provide:

1. **Official first-party source.** We control what's in `llms.txt`. Third-party crawlers index what they find; we index what Mapbox says matters.
2. **Mapbox-specific structured knowledge.** Token scopes, style layer properties, Streets v8 field definitions — structured resources that no generic crawler produces.
3. **Zero friction.** No API key, no account, no rate limits for basic use. Any developer, any AI assistant, install and go.

## Design Principles

**No token required.** Documentation is public. Requiring a Mapbox access token to read docs creates unnecessary friction and blocks users who are still evaluating Mapbox. Any developer, any AI assistant, no setup beyond installing the server.

**Always current.** Documentation is fetched from live sources, not a static snapshot baked into the package. When Mapbox updates docs, the server reflects it immediately.

**Read-only by default.** This server never writes to Mapbox APIs. It exists solely to inform. The [Mapbox MCP DevKit Server](https://github.com/mapbox/mcp-devkit-server) handles actions; this server handles knowledge.

**Sharp before broad.** Do a few things excellently rather than many things adequately. Expand the surface area only when the foundation is solid.

**Composable.** The server works standalone or alongside the DevKit server and [Mapbox Agent Skills](https://github.com/mapbox/mapbox-agent-skills). Each layer has a distinct role:

| Layer                           | Role                                                | Example                                          |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| **mcp-docs-server** (this repo) | Knowledge — what Mapbox is, how APIs work           | "What parameters does the Geocoding API accept?" |
| **mcp-devkit-server**           | Actions — create, read, update Mapbox resources     | `create_style_tool`, `list_tokens_tool`          |
| **mapbox-agent-skills**         | Patterns — best practices and architecture guidance | Performance patterns, cartography principles     |

## Roadmap

### Phase 1: Index and Static References (shipped)

Provide the documentation index (`llms.txt`) and curated static references. The agent knows what Mapbox products exist and where to find documentation. Static references cover style layers, Streets v8 fields, token scopes, and layer type mappings — structured knowledge no crawler produces.

### Phase 2: Full Content Retrieval (in progress)

Let the agent follow links from the index to retrieve full page content. The two-step pattern — get the index, then fetch specific pages — makes the documentation corpus traversable without us having to index everything ourselves.

- `get_document_tool` — fetch one page by URL
- `batch_get_documents_tool` — fetch up to 20 pages in one call
- Granular index resources — `mapbox-api-reference`, `mapbox-sdk-docs`, `mapbox-guides`, `mapbox-examples`, `mapbox-reference`

## Success Criteria

The server is succeeding when:

1. An AI assistant with this server installed consistently gives accurate, current Mapbox guidance — correct API parameters, current SDK syntax, valid style spec.
2. Developers spend less time cross-referencing the Mapbox docs manually because the agent already has the right context.
3. The server becomes a standard part of the Mapbox developer setup, alongside the SDK and access token.

## What This Is Not

This server is not a search engine, a chatbot, or a support tool. General-purpose doc search is better served by third-party crawlers like Context7. This server exists to provide what they cannot: official, structured, Mapbox-specific knowledge with zero friction.
