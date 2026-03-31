// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HttpRequest } from '../../utils/types.js';
import { BaseTool } from '../BaseTool.js';
import {
  SearchDocsSchema,
  SearchDocsInput
} from './SearchDocsTool.input.schema.js';

// These are public search-only credentials embedded in every docs.mapbox.com
// browser session — safe to include in source.
const ALGOLIA_APP_ID = 'Z7QUXRWJ7L';
const ALGOLIA_SEARCH_KEY = '332b77ce8ccfba082ac50ad2d882c80a';
const ALGOLIA_INDEX = 'mapbox';
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

interface AlgoliaHierarchy {
  lvl0: string | null;
  lvl1: string | null;
  lvl2: string | null;
  lvl3: string | null;
  lvl4: string | null;
  lvl5: string | null;
  lvl6: string | null;
}

interface AlgoliaHit {
  url: string;
  content: string | null;
  hierarchy: AlgoliaHierarchy;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

function buildTitle(hierarchy: AlgoliaHierarchy): string {
  const levels = [
    hierarchy.lvl0,
    hierarchy.lvl1,
    hierarchy.lvl2,
    hierarchy.lvl3,
    hierarchy.lvl4,
    hierarchy.lvl5,
    hierarchy.lvl6
  ].filter((lvl): lvl is string => lvl !== null);
  return levels.map(stripHtml).join(' > ');
}

function formatResults(hits: AlgoliaHit[]): string {
  if (hits.length === 0) {
    return 'No results found.';
  }

  return hits
    .map((hit, i) => {
      const title = buildTitle(hit.hierarchy);
      const excerpt = hit.content ? stripHtml(hit.content).trim() : '';
      const lines = [`${i + 1}. **${title}**`, `   URL: ${hit.url}`];
      if (excerpt) {
        lines.push(`   > ${excerpt}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export class SearchDocsTool extends BaseTool<typeof SearchDocsSchema> {
  name = 'search_mapbox_docs_tool';
  description =
    'Search Mapbox documentation by keyword or natural language query. Returns ranked results with titles, URLs, and content excerpts. Use get_document_tool to fetch the full content of a result page.';
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    title: 'Search Mapbox Docs Tool'
  };

  private httpRequest: HttpRequest;

  constructor(params: { httpRequest: HttpRequest }) {
    super({ inputSchema: SearchDocsSchema });
    this.httpRequest = params.httpRequest;
  }

  protected async execute(input: SearchDocsInput): Promise<CallToolResult> {
    const body = JSON.stringify({
      query: input.query,
      hitsPerPage: input.limit
    });

    let data: AlgoliaResponse;

    try {
      const response = await this.httpRequest(ALGOLIA_URL, {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': ALGOLIA_APP_ID,
          'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
          'Content-Type': 'application/json'
        },
        body
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Search request failed: ${response.status} ${response.statusText}`
            }
          ],
          isError: true
        };
      }

      data = (await response.json()) as AlgoliaResponse;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [{ type: 'text', text: `Search request failed: ${message}` }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text', text: formatResults(data.hits) }],
      isError: false
    };
  }
}
