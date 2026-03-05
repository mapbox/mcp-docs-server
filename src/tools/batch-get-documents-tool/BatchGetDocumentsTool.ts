// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { docCache } from '../../utils/docCache.js';
import type { HttpRequest } from '../../utils/types.js';
import { BaseTool } from '../BaseTool.js';
import {
  BatchGetDocumentsSchema,
  BatchGetDocumentsInput
} from './BatchGetDocumentsTool.input.schema.js';

function isMapboxUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'mapbox.com' || hostname.endsWith('.mapbox.com');
  } catch {
    return false;
  }
}

type DocumentResult =
  | { url: string; content: string }
  | { url: string; error: string };

export class BatchGetDocumentsTool extends BaseTool<
  typeof BatchGetDocumentsSchema
> {
  name = 'batch_get_documents_tool';
  description =
    'Fetch the full content of multiple Mapbox documentation pages in a single call (max 20). More efficient than calling get_document_tool multiple times. Returns an array of results — failed pages include an error message rather than failing the whole batch.';
  readonly annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    title: 'Batch Get Mapbox Documents Tool'
  };

  private httpRequest: HttpRequest;

  constructor(params: { httpRequest: HttpRequest }) {
    super({ inputSchema: BatchGetDocumentsSchema });
    this.httpRequest = params.httpRequest;
  }

  protected async execute(
    input: BatchGetDocumentsInput
  ): Promise<CallToolResult> {
    const invalidUrls = input.urls.filter((url) => !isMapboxUrl(url));
    if (invalidUrls.length > 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid URLs: only mapbox.com URLs are supported. Invalid: ${invalidUrls.join(', ')}`
          }
        ],
        isError: true
      };
    }

    const results = await Promise.allSettled(
      input.urls.map(async (url): Promise<DocumentResult> => {
        const cached = docCache.get(url);
        if (cached !== null) {
          return { url, content: cached };
        }

        const response = await this.httpRequest(url, {
          headers: { Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8' }
        });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const content = await response.text();
        docCache.set(url, content);
        return { url, content };
      })
    );

    const output: DocumentResult[] = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        url: input.urls[i],
        error:
          result.reason instanceof Error
            ? result.reason.message
            : 'Unknown error'
      };
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      isError: false
    };
  }
}
