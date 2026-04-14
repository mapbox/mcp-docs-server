// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HttpRequest } from '../../utils/types.js';
import { fetchCachedText } from '../../utils/docFetcher.js';
import { BaseTool } from '../BaseTool.js';
import {
  GetDocsIndexSchema,
  GetDocsIndexInput,
  PRODUCT_SOURCES
} from './GetDocsIndexTool.input.schema.js';

export class GetDocsIndexTool extends BaseTool<typeof GetDocsIndexSchema> {
  name = 'get_mapbox_docs_index_tool';
  description =
    'Fetch the documentation index (llms.txt) for a specific Mapbox product. ' +
    "Returns a structured list of all pages in that product's documentation with titles, " +
    'URLs, and descriptions — ready to use with get_document_tool to fetch full page content. ' +
    'Use "catalog" to discover all available Mapbox products. ' +
    'Prefer this over search_mapbox_docs_tool when you know which product you need.';
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    title: 'Get Mapbox Docs Index Tool'
  };

  private httpRequest: HttpRequest;

  constructor(params: { httpRequest: HttpRequest }) {
    super({ inputSchema: GetDocsIndexSchema });
    this.httpRequest = params.httpRequest;
  }

  protected async execute(input: GetDocsIndexInput): Promise<CallToolResult> {
    const source = PRODUCT_SOURCES[input.product];

    try {
      const content = await fetchCachedText(source.url, this.httpRequest);
      return {
        content: [
          {
            type: 'text',
            text: `# ${source.label}\n\n${content}`
          }
        ],
        isError: false
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Failed to fetch ${source.label} index: ${message}`
          }
        ],
        isError: true
      };
    }
  }
}
