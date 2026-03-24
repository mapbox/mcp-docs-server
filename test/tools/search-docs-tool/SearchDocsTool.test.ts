// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi } from 'vitest';
import { SearchDocsTool } from '../../../src/tools/search-docs-tool/SearchDocsTool.js';

function makeResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const sampleHits = [
  {
    url: 'https://docs.mapbox.com/mapbox-gl-js/example/add-a-marker/',
    content: 'Use a Marker to add a visual indicator to the map.',
    hierarchy: {
      lvl0: 'Mapbox GL JS',
      lvl1: 'Examples',
      lvl2: 'Add a marker to the map',
      lvl3: null,
      lvl4: null,
      lvl5: null,
      lvl6: null
    }
  },
  {
    url: 'https://docs.mapbox.com/ios/maps/guides/add-your-data/markers/#basic-marker',
    content: 'The simplest way to add a marker is to specify a coordinate.',
    hierarchy: {
      lvl0: 'Maps SDK for iOS',
      lvl1: 'Markers',
      lvl2: 'Adding a basic marker',
      lvl3: null,
      lvl4: null,
      lvl5: null,
      lvl6: null
    }
  }
];

describe('SearchDocsTool', () => {
  it('returns formatted results for a successful search', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(makeResponse({ hits: sampleHits }));
    const tool = new SearchDocsTool({ httpRequest });

    const result = await tool.run({ query: 'add a marker', limit: 5 });

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('Mapbox GL JS > Examples > Add a marker to the map');
    expect(text).toContain(
      'https://docs.mapbox.com/mapbox-gl-js/example/add-a-marker/'
    );
    expect(text).toContain('Use a Marker to add a visual indicator');
    expect(text).toContain(
      'Maps SDK for iOS > Markers > Adding a basic marker'
    );
  });

  it('POSTs to the Algolia endpoint with correct headers and body', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse({ hits: [] }));
    const tool = new SearchDocsTool({ httpRequest });

    await tool.run({ query: 'geocoding', limit: 3 });

    expect(httpRequest).toHaveBeenCalledWith(
      expect.stringContaining('algolia.net'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Algolia-Application-Id': 'Z7QUXRWJ7L',
          'X-Algolia-API-Key': expect.any(String)
        }),
        body: JSON.stringify({ query: 'geocoding', hitsPerPage: 3 })
      })
    );
  });

  it('returns "No results found" when hits array is empty', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse({ hits: [] }));
    const tool = new SearchDocsTool({ httpRequest });

    const result = await tool.run({ query: 'xyzzy nonexistent' });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('No results found.');
  });

  it('returns error result when response is not ok', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(makeResponse({ message: 'Invalid API key' }, 403));
    const tool = new SearchDocsTool({ httpRequest });

    const result = await tool.run({ query: 'markers' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403');
  });

  it('returns error result on network failure', async () => {
    const httpRequest = vi.fn().mockRejectedValue(new Error('Network error'));
    const tool = new SearchDocsTool({ httpRequest });

    const result = await tool.run({ query: 'markers' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network error');
  });

  it('strips HTML highlight tags from content and hierarchy', async () => {
    const httpRequest = vi.fn().mockResolvedValue(
      makeResponse({
        hits: [
          {
            url: 'https://docs.mapbox.com/api/search/geocoding/',
            content:
              'Use the <span class="algolia-docsearch-suggestion--highlight">Geocoding</span> API to convert addresses.',
            hierarchy: {
              lvl0: '<span class="algolia-docsearch-suggestion--highlight">Geocoding</span> API',
              lvl1: 'Overview',
              lvl2: null,
              lvl3: null,
              lvl4: null,
              lvl5: null,
              lvl6: null
            }
          }
        ]
      })
    );
    const tool = new SearchDocsTool({ httpRequest });

    const result = await tool.run({ query: 'geocoding' });
    const text = result.content[0].text as string;

    expect(text).not.toContain('<span');
    expect(text).toContain('Geocoding API');
    expect(text).toContain('Use the Geocoding API to convert addresses.');
  });

  it('handles hits with null content gracefully', async () => {
    const httpRequest = vi.fn().mockResolvedValue(
      makeResponse({
        hits: [
          {
            url: 'https://docs.mapbox.com/api/search/',
            content: null,
            hierarchy: {
              lvl0: 'Search',
              lvl1: null,
              lvl2: null,
              lvl3: null,
              lvl4: null,
              lvl5: null,
              lvl6: null
            }
          }
        ]
      })
    );
    const tool = new SearchDocsTool({ httpRequest });

    const result = await tool.run({ query: 'search' });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Search');
    expect(result.content[0].text).not.toContain('undefined');
  });

  it('uses default limit of 5 when not specified', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse({ hits: [] }));
    const tool = new SearchDocsTool({ httpRequest });

    await tool.run({ query: 'navigation' });

    expect(httpRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ query: 'navigation', hitsPerPage: 5 })
      })
    );
  });
});
