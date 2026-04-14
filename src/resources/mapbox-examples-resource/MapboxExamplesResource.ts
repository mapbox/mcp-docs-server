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
import {
  parseDocSections,
  filterSectionsByCategory,
  sectionsToMarkdown
} from '../utils/docParser.js';

/**
 * Resource providing links to Mapbox interactive examples and playgrounds.
 * Extracts the examples/playground/demo sections from the root llms.txt
 * catalog, which lists API playgrounds, demo apps, and open-code projects.
 */
export class MapboxExamplesResource extends BaseResource {
  readonly name = 'Mapbox Examples';
  readonly uri = 'resource://mapbox-examples';
  readonly description =
    'Mapbox interactive API playgrounds, demo applications, and code examples. ' +
    'Includes playground URLs for Directions, Search Box, Static Images, ' +
    'Isochrone, Matrix APIs, and demo apps for real estate, store locator, etc.';
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

      // Extract playground/demo/example sections from the catalog index
      const allSections = parseDocSections(content);
      const exampleSections = filterSectionsByCategory(allSections, 'examples');
      const exampleContent = sectionsToMarkdown(exampleSections);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: this.mimeType,
            text: `# Mapbox Examples\n\n${exampleContent}`
          }
        ]
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to fetch Mapbox examples: ${errorMessage}`, {
        cause: error
      });
    }
  }
}
