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
 * Resource providing Mapbox API reference documentation.
 * Fetches the aggregated API reference index from docs.mapbox.com/api/llms.txt,
 * which lists all Mapbox REST API endpoints grouped by service category
 * (Maps, Navigation, Search, Accounts, etc.) with direct links to each
 * API reference page.
 */
export class MapboxApiReferenceResource extends BaseResource {
  readonly name = 'Mapbox API Reference';
  readonly uri = 'resource://mapbox-api-reference';
  readonly description =
    'Mapbox REST API reference index organized by service (Maps, Navigation, Search, Accounts). ' +
    'Lists all API endpoints with links to detailed reference pages covering parameters, ' +
    'rate limits, authentication, and response formats (Geocoding, Directions, Static Images, ' +
    'Tilequery, Matrix, isochrone, Optimization, Styles, Uploads, Datasets, and more).';
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
        'https://docs.mapbox.com/api/llms.txt',
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
      throw new Error(`Failed to fetch Mapbox API reference: ${errorMessage}`, {
        cause: error
      });
    }
  }
}
