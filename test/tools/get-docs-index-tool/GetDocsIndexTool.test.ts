// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetDocsIndexTool } from '../../../src/tools/get-docs-index-tool/GetDocsIndexTool.js';
import { PRODUCT_SOURCES } from '../../../src/tools/get-docs-index-tool/GetDocsIndexTool.input.schema.js';
import { docCache } from '../../../src/utils/docCache.js';

beforeEach(() => {
  docCache.clear();
});

function makeResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain' }
  });
}

describe('GetDocsIndexTool', () => {
  it('fetches the correct URL for a given product key', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(
        makeResponse(
          '- [Geocoding](https://docs.mapbox.com/api/search/geocoding/): Geocoding API'
        )
      );
    const tool = new GetDocsIndexTool({ httpRequest });

    const result = await tool.run({ product: 'api-reference' });

    expect(httpRequest).toHaveBeenCalledWith(
      PRODUCT_SOURCES['api-reference'].url,
      expect.any(Object)
    );
    expect(result.isError).toBe(false);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Mapbox REST API Reference');
    expect(text).toContain('Geocoding');
  });

  it('serves subsequent requests from cache without re-fetching', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(makeResponse('index content'));
    const tool = new GetDocsIndexTool({ httpRequest });

    await tool.run({ product: 'mapbox-gl-js' });
    await tool.run({ product: 'mapbox-gl-js' });

    expect(httpRequest).toHaveBeenCalledTimes(1);
  });

  it('returns an error result on HTTP failure', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );
    const tool = new GetDocsIndexTool({ httpRequest });

    const result = await tool.run({ product: 'help-guides' });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/failed to fetch/i);
  });

  it('returns an error result on network error', async () => {
    const httpRequest = vi.fn().mockRejectedValue(new Error('Network error'));
    const tool = new GetDocsIndexTool({ httpRequest });

    const result = await tool.run({ product: 'catalog' });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'Network error'
    );
  });

  it('rejects unknown product keys', async () => {
    const httpRequest = vi.fn();
    const tool = new GetDocsIndexTool({ httpRequest });

    const result = await tool.run({ product: 'not-a-real-product' });

    expect(result.isError).toBe(true);
    expect(httpRequest).not.toHaveBeenCalled();
  });
});
