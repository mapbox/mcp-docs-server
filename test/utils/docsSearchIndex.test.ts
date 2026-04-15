// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect } from 'vitest';
import {
  parseLlmsTxtEntries,
  searchDocs
} from '../../src/utils/docsSearchIndex.js';
import { docCache } from '../../src/utils/docCache.js';
import { vi, beforeEach } from 'vitest';

const SAMPLE_LLMS_TXT = `# Mapbox GL JS

> Documentation for Mapbox GL JS

## Guides

- [Add your data to the map](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data.md): Mapbox GL JS offers several ways to add your data to the map.
- [Markers](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/markers.md): Add interactive markers to your map with minimal code using the Marker class.
- [Getting Started](https://docs.mapbox.com/mapbox-gl-js/guides/get-started.md): Get started with Mapbox GL JS.

## Examples

- [Add a marker to the map](https://docs.mapbox.com/mapbox-gl-js/example/add-a-marker.md): Use a Marker to add a visual indicator to the map.

## Other products

- [Maps SDK for iOS](https://docs.mapbox.com/ios/maps/llms.txt)
`;

beforeEach(() => {
  docCache.clear();
});

describe('parseLlmsTxtEntries', () => {
  it('parses title, url, and description from entries', () => {
    const entries = parseLlmsTxtEntries(SAMPLE_LLMS_TXT, 'Mapbox GL JS');

    expect(entries).toContainEqual({
      title: 'Markers',
      url: 'https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/markers.md',
      description:
        'Add interactive markers to your map with minimal code using the Marker class.',
      product: 'Mapbox GL JS'
    });
  });

  it('parses entries without a description', () => {
    const content = `## Guides\n\n- [Getting Started](https://docs.mapbox.com/guide.md)`;
    const entries = parseLlmsTxtEntries(content, 'Test');

    expect(entries).toHaveLength(1);
    expect(entries[0].description).toBe('');
  });

  it('skips llms.txt index links (not doc pages)', () => {
    const entries = parseLlmsTxtEntries(SAMPLE_LLMS_TXT, 'Mapbox GL JS');
    const urls = entries.map((e) => e.url);

    expect(urls.every((u) => !u.endsWith('/llms.txt'))).toBe(true);
    expect(urls.every((u) => !u.endsWith('/llms-full.txt'))).toBe(true);
  });

  it('skips non-entry lines (headers, blank lines, descriptions)', () => {
    const entries = parseLlmsTxtEntries(SAMPLE_LLMS_TXT, 'Mapbox GL JS');

    // Only actual doc page links should be parsed (4 entries, 1 llms.txt skipped)
    expect(entries).toHaveLength(4);
  });

  it('assigns the provided product name to all entries', () => {
    const entries = parseLlmsTxtEntries(SAMPLE_LLMS_TXT, 'My Product');
    expect(entries.every((e) => e.product === 'My Product')).toBe(true);
  });
});

describe('searchDocs', () => {
  function makeResponse(content: string): Response {
    return new Response(content, {
      status: 200,
      headers: {
        'content-type': 'text/plain',
        'content-length': String(Buffer.byteLength(content, 'utf8'))
      }
    });
  }

  it('returns entries matching query words', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeResponse(SAMPLE_LLMS_TXT));
      return Promise.resolve(makeResponse(''));
    });

    const results = await searchDocs('marker', 5, httpRequest);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title.toLowerCase().includes('marker'))).toBe(
      true
    );
  });

  it('returns empty array when nothing matches', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse(''));
    const results = await searchDocs('xyzzy impossible query', 5, httpRequest);

    expect(results).toHaveLength(0);
  });

  it('ranks title matches higher than description-only matches', async () => {
    const content =
      `## Guides\n\n` +
      `- [Marker Guide](https://docs.mapbox.com/marker.md): How to use markers.\n` +
      `- [Getting Started](https://docs.mapbox.com/start.md): Add a marker to your map using this guide.\n`;

    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeResponse(content));
      return Promise.resolve(makeResponse(''));
    });

    const results = await searchDocs('marker', 5, httpRequest);

    // "Marker Guide" (title match) should rank above "Getting Started" (description match)
    expect(results[0].title).toBe('Marker Guide');
  });

  it('deduplicates entries with the same URL', async () => {
    const content = `## Guides\n\n- [Directions](https://docs.mapbox.com/api/directions.md): Routing API.`;
    const httpRequest = vi.fn().mockResolvedValue(makeResponse(content));

    const results = await searchDocs('directions', 10, httpRequest);

    const urls = results.map((r) => r.url);
    const unique = new Set(urls);
    expect(urls.length).toBe(unique.size);
  });

  it('respects the limit', async () => {
    const httpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/mapbox-gl-js/llms.txt'))
        return Promise.resolve(makeResponse(SAMPLE_LLMS_TXT));
      return Promise.resolve(makeResponse(''));
    });

    const results = await searchDocs('map', 2, httpRequest);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});
