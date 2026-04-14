// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  toMarkdownUrl,
  fetchDocContent,
  fetchCachedText
} from '../../src/utils/docFetcher.js';
import { docCache } from '../../src/utils/docCache.js';

function makeResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/markdown',
      'content-length': String(Buffer.byteLength(body, 'utf8'))
    }
  });
}

beforeEach(() => {
  docCache.clear();
});

afterEach(() => {
  delete process.env.MAPBOX_DOCS_HOST_OVERRIDE;
});

describe('toMarkdownUrl', () => {
  it('appends .md to a docs.mapbox.com URL', () => {
    expect(toMarkdownUrl('https://docs.mapbox.com/accounts/guides')).toBe(
      'https://docs.mapbox.com/accounts/guides.md'
    );
  });

  it('strips trailing slash before appending .md', () => {
    expect(toMarkdownUrl('https://docs.mapbox.com/accounts/guides/')).toBe(
      'https://docs.mapbox.com/accounts/guides.md'
    );
  });

  it('returns null for non-docs.mapbox.com URLs', () => {
    expect(toMarkdownUrl('https://api.mapbox.com/geocoding/v5')).toBeNull();
    expect(toMarkdownUrl('https://mapbox.com/about')).toBeNull();
    expect(toMarkdownUrl('https://example.com/page')).toBeNull();
  });

  it('preserves query parameters', () => {
    expect(
      toMarkdownUrl('https://docs.mapbox.com/accounts/guides?foo=bar')
    ).toBe('https://docs.mapbox.com/accounts/guides.md?foo=bar');
  });

  it('substitutes the staging host when MAPBOX_DOCS_HOST_OVERRIDE is set', () => {
    process.env.MAPBOX_DOCS_HOST_OVERRIDE = 'docs.tilestream.net';
    expect(toMarkdownUrl('https://docs.mapbox.com/accounts/guides')).toBe(
      'https://docs.tilestream.net/accounts/guides.md'
    );
  });

  it('returns null for .txt URLs (already a text file, no rewrite needed)', () => {
    expect(
      toMarkdownUrl('https://docs.mapbox.com/mapbox-gl-js/llms.txt')
    ).toBeNull();
    expect(
      toMarkdownUrl('https://docs.mapbox.com/mapbox-gl-js/llms-full.txt')
    ).toBeNull();
    expect(toMarkdownUrl('https://docs.mapbox.com/api/llms.txt')).toBeNull();
  });

  it('returns null for .md URLs (already markdown, no double-extension)', () => {
    expect(
      toMarkdownUrl('https://docs.mapbox.com/api/navigation/directions.md')
    ).toBeNull();
  });
});

describe('fetchCachedText', () => {
  it('fetches and caches the response', async () => {
    const content = '# Mapbox API\n\nSome content.';
    const httpRequest = vi.fn().mockResolvedValue(
      new Response(content, {
        status: 200,
        headers: {
          'content-type': 'text/plain',
          'content-length': String(Buffer.byteLength(content, 'utf8'))
        }
      })
    );

    const result = await fetchCachedText(
      'https://docs.mapbox.com/api/llms.txt',
      httpRequest
    );

    expect(result).toBe(content);
    expect(httpRequest).toHaveBeenCalledTimes(1);

    // Second call should use cache, not make another request
    const result2 = await fetchCachedText(
      'https://docs.mapbox.com/api/llms.txt',
      httpRequest
    );
    expect(result2).toBe(content);
    expect(httpRequest).toHaveBeenCalledTimes(1);
  });

  it('throws if the response is not ok', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

    await expect(
      fetchCachedText('https://docs.mapbox.com/api/llms.txt', httpRequest)
    ).rejects.toThrow('Not Found');
  });
});

describe('fetchDocContent', () => {
  it('fetches the .md URL for docs.mapbox.com and returns markdown content', async () => {
    const markdown = '# Accounts\n\nSome content.';
    const httpRequest = vi.fn().mockResolvedValue(makeResponse(markdown));

    const content = await fetchDocContent(
      'https://docs.mapbox.com/accounts/guides',
      httpRequest
    );

    expect(httpRequest).toHaveBeenCalledTimes(1);
    expect(httpRequest).toHaveBeenCalledWith(
      'https://docs.mapbox.com/accounts/guides.md',
      {}
    );
    expect(content).toBe(markdown);
  });

  it('falls back to original URL if .md returns non-2xx', async () => {
    const html = '<html>content</html>';
    const httpRequest = vi
      .fn()
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(makeResponse(html));

    const content = await fetchDocContent(
      'https://docs.mapbox.com/accounts/guides',
      httpRequest
    );

    expect(httpRequest).toHaveBeenCalledTimes(2);
    expect(httpRequest).toHaveBeenNthCalledWith(
      1,
      'https://docs.mapbox.com/accounts/guides.md',
      {}
    );
    expect(httpRequest).toHaveBeenNthCalledWith(
      2,
      'https://docs.mapbox.com/accounts/guides',
      expect.objectContaining({ headers: expect.anything() })
    );
    expect(content).toBe(html);
  });

  it('does not try .md for non-docs.mapbox.com URLs', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse('api response'));

    await fetchDocContent('https://api.mapbox.com/geocoding/v5', httpRequest);

    expect(httpRequest).toHaveBeenCalledTimes(1);
    expect(httpRequest).toHaveBeenCalledWith(
      'https://api.mapbox.com/geocoding/v5',
      expect.objectContaining({ headers: expect.anything() })
    );
  });

  it('redirects to staging host when MAPBOX_DOCS_HOST_OVERRIDE is set', async () => {
    process.env.MAPBOX_DOCS_HOST_OVERRIDE = 'docs.tilestream.net';
    const markdown = '# Staging content';
    const httpRequest = vi.fn().mockResolvedValue(makeResponse(markdown));

    const content = await fetchDocContent(
      'https://docs.mapbox.com/accounts/guides',
      httpRequest
    );

    expect(httpRequest).toHaveBeenCalledWith(
      'https://docs.tilestream.net/accounts/guides.md',
      {}
    );
    expect(content).toBe(markdown);
  });

  it('throws if the final response is non-2xx', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

    await expect(
      fetchDocContent('https://api.mapbox.com/missing', httpRequest)
    ).rejects.toThrow('404 Not Found');
  });
});
