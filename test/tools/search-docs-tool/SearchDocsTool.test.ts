// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchDocsTool } from '../../../src/tools/search-docs-tool/SearchDocsTool.js';
import { docCache } from '../../../src/utils/docCache.js';

const GL_JS_LLMS_TXT = `# Mapbox GL JS

> Documentation for Mapbox GL JS

## Guides

- [Add your data to the map](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data.md): Mapbox GL JS offers several ways to add your data to the map.
- [Markers](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/markers.md): Add interactive markers to your map with minimal code using the Marker class.
- [Getting Started](https://docs.mapbox.com/mapbox-gl-js/guides/get-started.md): Get started with Mapbox GL JS.

## Examples

- [Add a marker to the map](https://docs.mapbox.com/mapbox-gl-js/example/add-a-marker.md): Use a Marker to add a visual indicator to the map.
`;

const API_LLMS_TXT = `# API Docs

> Documentation for Mapbox Web APIs

## Navigation

- [Directions API](https://docs.mapbox.com/api/navigation/directions.md): The Mapbox Directions API calculates optimal routes and produces turn-by-turn instructions.
- [Matrix API](https://docs.mapbox.com/api/navigation/matrix.md): The Mapbox Matrix API returns travel times between many points.

## Search

- [Geocoding API](https://docs.mapbox.com/api/search/geocoding.md): Convert addresses and place names to geographic coordinates.
`;

function makeLlmsTxtResponse(content: string): Response {
  return new Response(content, {
    status: 200,
    headers: {
      'content-type': 'text/plain',
      'content-length': String(Buffer.byteLength(content, 'utf8'))
    }
  });
}

beforeEach(() => {
  docCache.clear();
});

describe('SearchDocsTool', () => {
  it('returns ranked results matching the query', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      if (url.includes('/api/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(API_LLMS_TXT));
      return Promise.resolve(makeLlmsTxtResponse(''));
    });

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'add a marker', limit: 5 });

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('Markers');
    expect(text).toContain(
      'https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/markers.md'
    );
    expect(text).toContain('Mapbox GL JS');
  });

  it('returns "No results found" when nothing matches', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      return Promise.resolve(makeLlmsTxtResponse(''));
    });

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'xyzzy nonexistent quantum' });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('No results found.');
  });

  it('respects the limit parameter', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      if (url.includes('/api/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(API_LLMS_TXT));
      return Promise.resolve(makeLlmsTxtResponse(''));
    });

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'map', limit: 2 });

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    // Numbered list — should not contain "3."
    expect(text).toContain('1.');
    expect(text).toContain('2.');
    expect(text).not.toContain('3.');
  });

  it('searches across multiple product sources', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      if (url.includes('/api/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(API_LLMS_TXT));
      return Promise.resolve(makeLlmsTxtResponse(''));
    });

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'directions', limit: 5 });

    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('Directions API');
    expect(text).toContain('API Reference');
  });

  it('deduplicates results when same URL appears in multiple sources', async () => {
    const duplicate = `# Product A\n\n## Guides\n\n- [Geocoding Guide](https://docs.mapbox.com/api/search/geocoding.md): How to geocode.`;
    const httpRequest = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(makeLlmsTxtResponse(duplicate))
      );

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'geocoding', limit: 10 });

    const text = result.content[0].text as string;
    // Count occurrences of the URL — should appear only once
    const count = (
      text.match(/docs\.mapbox\.com\/api\/search\/geocoding/g) ?? []
    ).length;
    expect(count).toBe(1);
  });

  it('includes product name in each result', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      return Promise.resolve(makeLlmsTxtResponse(''));
    });

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'getting started' });

    expect(result.content[0].text).toContain('Mapbox GL JS');
  });

  it('gracefully skips sources that fail to fetch', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      // All other sources fail
      return Promise.reject(new Error('Network error'));
    });

    const tool = new SearchDocsTool({ httpRequest });
    const result = await tool.run({ query: 'marker' });

    // Should still return results from the working source
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Markers');
  });

  it('uses cached content on repeated searches without re-fetching', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeLlmsTxtResponse(GL_JS_LLMS_TXT));
      return Promise.resolve(makeLlmsTxtResponse(''));
    });

    const tool = new SearchDocsTool({ httpRequest });
    await tool.run({ query: 'marker' });

    const callsAfterFirst = httpRequest.mock.calls.length;

    // Second search — all sources should be cached
    await tool.run({ query: 'marker' });

    expect(httpRequest.mock.calls.length).toBe(callsAfterFirst);
  });
});
