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
      'https://docs.mapbox.com/accounts/guides/',
      {}
    );
    expect(content).toBe(html);
  });

  it('does not try .md for non-docs.mapbox.com URLs', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse('api response'));

    await fetchDocContent('https://api.mapbox.com/geocoding/v5', httpRequest);

    expect(httpRequest).toHaveBeenCalledTimes(1);
    expect(httpRequest).toHaveBeenCalledWith(
      'https://api.mapbox.com/geocoding/v5',
      {}
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

describe('fallback URL', () => {
  it('adds a trailing slash to extension-less paths on the fallback fetch', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValueOnce(makeResponse('', 404))
      .mockResolvedValueOnce(makeResponse('html page'));

    await fetchDocContent('https://docs.mapbox.com/api/search', httpRequest);

    expect(httpRequest.mock.calls[1][0]).toBe(
      'https://docs.mapbox.com/api/search/'
    );
  });

  it('leaves paths with a file extension unchanged', async () => {
    const httpRequest = vi.fn().mockResolvedValue(makeResponse('text'));

    await fetchDocContent('https://docs.mapbox.com/llms.txt', httpRequest);

    expect(httpRequest.mock.calls[0][0]).toBe(
      'https://docs.mapbox.com/llms.txt'
    );
  });
});

describe('redirect handling', () => {
  function redirectResponse(location: string): Response {
    return new Response(null, { status: 302, headers: { location } });
  }

  it('fetchDocContent falls back from a redirecting .md URL, then errors on a redirecting fallback', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(redirectResponse('https://example.com/other'));

    await expect(
      fetchDocContent('https://docs.mapbox.com/page', httpRequest)
    ).rejects.toThrow('302 Redirect not followed');

    expect(httpRequest.mock.calls.map((c) => c[0])).toEqual([
      'https://docs.mapbox.com/page.md',
      'https://docs.mapbox.com/page/'
    ]);
  });

  it('fetchDocContent does not include the Location header in the error', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(redirectResponse('https://other.example/target'));

    await expect(
      fetchDocContent('https://docs.mapbox.com/page', httpRequest)
    ).rejects.not.toThrow(/other\.example/);
  });

  it('fetchCachedText rejects a redirect and does not cache it', async () => {
    const httpRequest = vi
      .fn()
      .mockResolvedValue(redirectResponse('https://example.com/other'));

    await expect(
      fetchCachedText('https://docs.mapbox.com/llms.txt', httpRequest)
    ).rejects.toThrow('Redirect not followed');
    expect(docCache.get('https://docs.mapbox.com/llms.txt')).toBeNull();
  });
});

describe('following allowed redirects', () => {
  function redirect(status: number, location?: string): Response {
    const headers: Record<string, string> = {};
    if (location !== undefined) headers.location = location;
    return new Response(null, { status, headers });
  }

  function routes(table: Record<string, () => Response>) {
    return vi.fn(async (input: string | URL | Request) => {
      const handler = table[String(input)];
      return handler ? handler() : makeResponse('', 404);
    });
  }

  it('follows a moved page and prefers the .md variant of the new location', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/help/getting-started/attribution/': () =>
        redirect(301, '/help/dive-deeper/attribution/'),
      'https://docs.mapbox.com/help/dive-deeper/attribution/': () =>
        makeResponse('<html>attribution</html>'),
      'https://docs.mapbox.com/help/dive-deeper/attribution.md': () =>
        makeResponse('# Attribution')
    });

    const content = await fetchDocContent(
      'https://docs.mapbox.com/help/getting-started/attribution/',
      httpRequest
    );

    expect(content).toBe('# Attribution');
    expect(httpRequest.mock.calls.map((c) => c[0])).toEqual([
      'https://docs.mapbox.com/help/getting-started/attribution.md',
      'https://docs.mapbox.com/help/getting-started/attribution/',
      'https://docs.mapbox.com/help/dive-deeper/attribution.md'
    ]);
  });

  it('returns the HTML of the new location when it has no .md variant', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/old/': () =>
        redirect(301, 'https://docs.mapbox.com/new/'),
      'https://docs.mapbox.com/new/': () => makeResponse('<html>new</html>')
    });

    await expect(
      fetchDocContent('https://docs.mapbox.com/old/', httpRequest)
    ).resolves.toBe('<html>new</html>');
  });

  it.each([301, 302, 303, 307, 308])('follows a %i', async (status) => {
    const httpRequest = routes({
      'https://docs.mapbox.com/a/': () => redirect(status, '/b/'),
      'https://docs.mapbox.com/b/': () => makeResponse('b')
    });

    await expect(
      fetchDocContent('https://docs.mapbox.com/a/', httpRequest)
    ).resolves.toBe('b');
  });

  it.each([300, 304, 305])('does not follow a %i', async (status) => {
    const httpRequest = routes({
      'https://docs.mapbox.com/a/': () => redirect(status, '/b/'),
      'https://docs.mapbox.com/b/': () => makeResponse('b')
    });

    await expect(
      fetchDocContent('https://docs.mapbox.com/a/', httpRequest)
    ).rejects.toThrow('Redirect not followed');
    expect(httpRequest.mock.calls.map((c) => c[0])).not.toContain(
      'https://docs.mapbox.com/b/'
    );
  });

  it.each([
    ['another host', 'https://example.com/x'],
    ['http scheme', 'http://docs.mapbox.com/x'],
    ['explicit port', 'https://docs.mapbox.com:8443/x'],
    ['userinfo trick', 'https://docs.mapbox.com@example.com/x'],
    ['protocol-relative host', '//example.com/x'],
    ['backslash host', '\\\\example.com/x'],
    ['bare mapbox.com', 'https://mapbox.com/x'],
    ['access_token', 'https://docs.mapbox.com/x?access_token=pk.secret'],
    [
      'uppercase ACCESS_TOKEN',
      'https://docs.mapbox.com/x?ACCESS_TOKEN=pk.secret'
    ],
    ['empty Location', ''],
    ['same URL', 'https://docs.mapbox.com/a/']
  ])(
    'rejects a redirect to %s without requesting it',
    async (_name, location) => {
      const httpRequest = routes({
        'https://docs.mapbox.com/a/': () => redirect(302, location)
      });

      await expect(
        fetchDocContent('https://docs.mapbox.com/a/', httpRequest)
      ).rejects.toThrow('302 Redirect not followed');

      for (const call of httpRequest.mock.calls) {
        expect(String(call[0])).toMatch(
          /^https:\/\/docs\.mapbox\.com\/a(\.md|\/)$/
        );
      }
    }
  );

  it('rejects a redirect with no Location header', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/a/': () => redirect(302)
    });

    await expect(
      fetchDocContent('https://docs.mapbox.com/a/', httpRequest)
    ).rejects.toThrow('302 Redirect not followed');
  });

  it('stops after 3 redirects', async () => {
    let n = 0;
    const httpRequest = vi.fn(async () => redirect(302, `/hop${++n}/`));

    await expect(
      fetchDocContent('https://docs.mapbox.com/start/', httpRequest)
    ).rejects.toThrow('Too many redirects');

    // .md attempt: 1 request plus 3 hops. Fallback: 1 request plus 3 hops,
    // and one .md probe per validated hop.
    expect(httpRequest).toHaveBeenCalledTimes(11);
  });

  it('follows a redirect to the staging host only when it is the override host', async () => {
    const table = {
      'https://docs.mapbox.com/a/': () =>
        redirect(302, 'https://docs.tilestream.net/b/'),
      'https://docs.tilestream.net/b/': () => makeResponse('staging')
    };

    await expect(
      fetchDocContent('https://docs.mapbox.com/a/', routes(table))
    ).rejects.toThrow('302 Redirect not followed');

    process.env.MAPBOX_DOCS_HOST_OVERRIDE = 'docs.tilestream.net';
    const overridden = routes({
      'https://docs.tilestream.net/a/': () =>
        redirect(302, 'https://docs.tilestream.net/b/'),
      'https://docs.tilestream.net/b/': () => makeResponse('staging')
    });
    await expect(
      fetchDocContent('https://docs.mapbox.com/a/', overridden)
    ).resolves.toBe('staging');
  });

  it('prefers the .md of a moved page on the staging host', async () => {
    process.env.MAPBOX_DOCS_HOST_OVERRIDE = 'docs.tilestream.net';
    const httpRequest = routes({
      'https://docs.tilestream.net/old/': () =>
        redirect(301, 'https://docs.tilestream.net/new/'),
      'https://docs.tilestream.net/new.md': () => makeResponse('# New')
    });

    await expect(
      fetchDocContent('https://docs.mapbox.com/old/', httpRequest)
    ).resolves.toBe('# New');
    expect(httpRequest.mock.calls.map((c) => c[0])).not.toContain(
      'https://docs.tilestream.net/new/'
    );
  });

  it('does not request the .md of a redirect target that is not allowed', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/old/': () =>
        redirect(301, 'https://docs.mapbox.com/new/?access_token=pk.x'),
      'https://docs.mapbox.com/new.md?access_token=pk.x': () =>
        makeResponse('# leaked')
    });

    await expect(
      fetchDocContent('https://docs.mapbox.com/old/', httpRequest)
    ).rejects.toThrow('301 Redirect not followed');
    expect(httpRequest.mock.calls.map((c) => c[0])).toEqual([
      'https://docs.mapbox.com/old.md',
      'https://docs.mapbox.com/old/'
    ]);
  });

  it('fetchCachedText follows a redirect to an allowed docs URL', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/llms.txt': () => redirect(301, '/docs/llms.txt'),
      'https://docs.mapbox.com/docs/llms.txt': () => makeResponse('index')
    });

    await expect(
      fetchCachedText('https://docs.mapbox.com/llms.txt', httpRequest)
    ).resolves.toBe('index');
  });

  it('fetchCachedText rejects a redirect that lands on an HTML page and does not cache it', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/x/llms.txt': () => redirect(301, '/x/'),
      'https://docs.mapbox.com/x/': () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'Text/HTML; charset=utf-8' }
        })
    });

    await expect(
      fetchCachedText('https://docs.mapbox.com/x/llms.txt', httpRequest)
    ).rejects.toThrow('Unexpected content type');
    expect(docCache.get('https://docs.mapbox.com/x/llms.txt')).toBeNull();
  });

  it('does not probe the same .md URL twice', async () => {
    const httpRequest = routes({
      'https://docs.mapbox.com/foo/': () =>
        redirect(301, 'https://docs.mapbox.com/foo'),
      'https://docs.mapbox.com/foo': () => makeResponse('<html>foo</html>')
    });

    await fetchDocContent('https://docs.mapbox.com/foo/', httpRequest);
    const urls = httpRequest.mock.calls.map((c) => c[0]);
    expect(
      urls.filter((u) => u === 'https://docs.mapbox.com/foo.md')
    ).toHaveLength(1);
  });
});
