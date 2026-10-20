// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { docCache } from '../../utils/docCache.js';
import { fetchDocContent } from '../../utils/docFetcher.js';
import { hasAccessToken, isDocsUrl } from '../../utils/docUrl.js';
import type { HttpRequest } from '../../utils/types.js';
import { BaseTool } from '../BaseTool.js';
import {
  GetDocumentSchema,
  GetDocumentInput
} from './GetDocumentTool.input.schema.js';

export class GetDocumentTool extends BaseTool<typeof GetDocumentSchema> {
  name = 'get_document_tool';
  description =
    'Fetch the full content of a specific Mapbox documentation page by URL. Use this after search_mapbox_docs_tool to follow a link from the search results and retrieve the complete page content. For fetching multiple pages at once, use batch_get_documents_tool instead.';
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
    if (!isDocsUrl(input.url)) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid URL: only https://docs.mapbox.com documentation URLs are supported. Received: ${input.url}`
          }
        ],
        isError: true
      };
    }

    if (hasAccessToken(input.url)) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid URL: URLs must not contain access_token. Received: ${input.url}`
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
