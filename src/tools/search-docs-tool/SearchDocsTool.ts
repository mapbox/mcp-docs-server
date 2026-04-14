// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HttpRequest } from '../../utils/types.js';
import { BaseTool } from '../BaseTool.js';
import {
  SearchDocsSchema,
  SearchDocsInput
} from './SearchDocsTool.input.schema.js';
import { searchDocs, type DocEntry } from '../../utils/docsSearchIndex.js';

function formatResults(entries: DocEntry[]): string {
  if (entries.length === 0) {
    return 'No results found.';
  }

  return entries
    .map((entry, i) => {
      const lines = [
        `${i + 1}. **${entry.title}** (${entry.product})`,
        `   URL: ${entry.url}`
      ];
      if (entry.description) {
        lines.push(`   > ${entry.description}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export class SearchDocsTool extends BaseTool<typeof SearchDocsSchema> {
  name = 'search_mapbox_docs_tool';
  description =
    'Search Mapbox documentation by keyword or natural language query. ' +
    'Searches across API reference, GL JS, Help Center, Style Spec, Studio, ' +
    'Search JS, iOS/Android Maps and Navigation SDKs, and Tilesets. ' +
    'Returns ranked results with titles, URLs, and descriptions. ' +
    'Use get_document_tool to fetch the full content of a result page.';
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
    try {
      const results = await searchDocs(
        input.query,
        input.limit,
        this.httpRequest
      );
      return {
        content: [{ type: 'text', text: formatResults(results) }],
        isError: false
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [{ type: 'text', text: `Search failed: ${message}` }],
        isError: true
      };
    }
  }
}
