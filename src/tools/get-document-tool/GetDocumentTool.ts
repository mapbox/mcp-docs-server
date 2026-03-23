// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { docCache } from '../../utils/docCache.js';
import { fetchDocContent } from '../../utils/docFetcher.js';
import type { HttpRequest } from '../../utils/types.js';
import { BaseTool } from '../BaseTool.js';
import {
  GetDocumentSchema,
  GetDocumentInput
} from './GetDocumentTool.input.schema.js';

function isMapboxUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'mapbox.com' || hostname.endsWith('.mapbox.com');
  } catch {
    return false;
  }
}

export class GetDocumentTool extends BaseTool<typeof GetDocumentSchema> {
  name = 'get_document_tool';
  description =
    'Fetch the full content of a specific Mapbox documentation page by URL. Use this after get_latest_mapbox_docs_tool to follow a link from the index and retrieve the complete page content. For fetching multiple pages at once, use batch_get_documents_tool instead.';
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    title: 'Get Mapbox Document Tool'
  };

  private httpRequest: HttpRequest;

  constructor(params: { httpRequest: HttpRequest }) {
    super({ inputSchema: GetDocumentSchema });
    this.httpRequest = params.httpRequest;
  }

  protected async execute(input: GetDocumentInput): Promise<CallToolResult> {
    if (!isMapboxUrl(input.url)) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid URL: only mapbox.com URLs are supported. Received: ${input.url}`
          }
        ],
        isError: true
      };
    }

    const cached = docCache.get(input.url);
    if (cached !== null) {
      return { content: [{ type: 'text', text: cached }], isError: false };
    }

    try {
      const content = await fetchDocContent(input.url, this.httpRequest);
      docCache.set(input.url, content);

      return { content: [{ type: 'text', text: content }], isError: false };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          { type: 'text', text: `Failed to fetch document: ${errorMessage}` }
        ],
        isError: true
      };
    }
  }
}
