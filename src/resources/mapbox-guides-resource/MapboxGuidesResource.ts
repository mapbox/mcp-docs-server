// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ReadResourceResult,
  ServerNotification,
  ServerRequest
} from '@modelcontextprotocol/sdk/types.js';
import type { HttpRequest } from '../../utils/types.js';
import { BaseResource } from '../BaseResource.js';
import { fetchCachedText } from '../../utils/docFetcher.js';

/**
 * Resource providing Mapbox guides, tutorials, and help articles.
 * Fetches from docs.mapbox.com/help/llms.txt which contains the full
 * Mapbox Help Center index: troubleshooting guides, how-to tutorials,
 * glossary, account setup, billing, and platform-specific walkthroughs.
 */
export class MapboxGuidesResource extends BaseResource {
  readonly name = 'Mapbox Guides';
  readonly uri = 'resource://mapbox-guides';
  readonly description =
    'Mapbox Help Center documentation: troubleshooting guides, how-to tutorials, ' +
    'glossary, account and billing setup, and walkthroughs for common developer tasks. ' +
    'Use this for conceptual guidance and step-by-step instructions.';
  readonly mimeType = 'text/markdown';

  private httpRequest: HttpRequest;

  constructor(params: { httpRequest: HttpRequest }) {
    super();
    this.httpRequest = params.httpRequest;
  }

  public async readCallback(
    uri: URL,
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  ): Promise<ReadResourceResult> {
    try {
      const content = await fetchCachedText(
        'https://docs.mapbox.com/help/llms.txt',
        this.httpRequest
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: this.mimeType,
            text: content
          }
        ]
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to fetch Mapbox guides: ${errorMessage}`, {
        cause: error
      });
    }
  }
}
