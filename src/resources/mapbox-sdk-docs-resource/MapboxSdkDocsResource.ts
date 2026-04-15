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
 * Resource providing Mapbox GL JS SDK documentation.
 * Fetches the Mapbox GL JS llms.txt index which lists all GL JS guides,
 * API reference pages, and examples with direct links to each page.
 * GL JS is the primary web mapping SDK; use get_document_tool to fetch
 * full content of any listed page.
 */
export class MapboxSdkDocsResource extends BaseResource {
  readonly name = 'Mapbox SDK Documentation';
  readonly uri = 'resource://mapbox-sdk-docs';
  readonly description =
    'Mapbox GL JS documentation index: guides for getting started, adding data, ' +
    'globe/projections, indoor mapping, gestures, styling layers, and migration. ' +
    'Also includes links to API reference and code examples. ' +
    'For mobile/native SDKs (iOS, Android, Flutter), use resource://mapbox-reference ' +
    'to discover their documentation URLs.';
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
        'https://docs.mapbox.com/mapbox-gl-js/llms.txt',
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
      throw new Error(`Failed to fetch Mapbox SDK docs: ${errorMessage}`, {
        cause: error
      });
    }
  }
}
