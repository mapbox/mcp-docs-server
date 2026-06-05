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

// Explicit allowlist of hostnames this docs tool is permitted to fetch.
// api.mapbox.com is intentionally excluded — it is a live API that requires
// auth tokens, not a documentation host. Allowing it would let callers poison
// the shared cache with token-authorized private responses under no-token keys.
const ALLOWED_DOC_HOSTNAMES = new Set([
  'docs.mapbox.com',
  'mapbox.com',
  'docs.tilestream.net'
]);

function isMapboxUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOC_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

function hasAccessToken(url: string): boolean {
  try {
    return new URL(url).searchParams.has('access_token');
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
            text: `Invalid URL: only mapbox.com documentation URLs are supported. Received: ${input.url}`
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
