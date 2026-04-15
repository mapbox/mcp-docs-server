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
 * Resource providing the complete Mapbox documentation catalog.
 * Fetches the root llms.txt which is now a structured index of every
 * Mapbox product and documentation section, each with a link to its
 * own llms.txt file. Use this to discover what documentation is available
 * and find URLs to pass to get_document_tool for deeper exploration.
 */
export class MapboxReferenceResource extends BaseResource {
  readonly name = 'Mapbox Reference';
  readonly uri = 'resource://mapbox-reference';
  readonly description =
    'Complete catalog of all Mapbox products and documentation. ' +
    'Lists every product section (Maps SDKs, Navigation APIs, Search APIs, ' +
    'Studio, Style Spec, Tilesets, Data products, Help Center, Atlas, Unity, etc.) ' +
    "with links to each product's own llms.txt index. Use this to discover " +
    'what documentation exists and find the right URLs to fetch full docs.';
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
        'https://docs.mapbox.com/llms.txt',
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
      throw new Error(`Failed to fetch Mapbox reference: ${errorMessage}`, {
        cause: error
      });
    }
  }
}
