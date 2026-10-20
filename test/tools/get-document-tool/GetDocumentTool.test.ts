// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetDocumentTool } from '../../../src/tools/get-document-tool/GetDocumentTool.js';
import { docCache } from '../../../src/utils/docCache.js';

beforeEach(() => {
  docCache.clear();
});

function makeResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain',
      'content-length': String(Buffer.byteLength(body, 'utf8'))
    }
  });
}

describe('GetDocumentTool', () => {
  describe('URL validation', () => {
    it('rejects non-mapbox URLs', async () => {
      const httpRequest = vi.fn();
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({ url: 'https://example.com/page' });

      expect(result.isError).toBe(true);
      expect(httpRequest).not.toHaveBeenCalled();
    });

    it('rejects api.mapbox.com URLs', async () => {
      const httpRequest = vi.fn();
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({
        url: 'https://api.mapbox.com/styles/v1/owner/styleId'
      });

      expect(result.isError).toBe(true);
      expect(httpRequest).not.toHaveBeenCalled();
    });

    it('rejects URLs containing access_token', async () => {
      const httpRequest = vi.fn();
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({
        url: 'https://docs.mapbox.com/page?access_token=pk.secret'
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toMatch(
        /access_token/
      );
      expect(httpRequest).not.toHaveBeenCalled();
    });

    it.each([
      'https://mapbox.com/about',
      'http://docs.mapbox.com/page',
      'https://docs.mapbox.com:8080/page',
      'https://192.0.2.1/'
    ])('rejects %s without making a request', async (url) => {
      const httpRequest = vi.fn();
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({ url });

      expect(result.isError).toBe(true);
      expect(httpRequest).not.toHaveBeenCalled();
    });

    it('allows docs.mapbox.com URLs', async () => {
      const httpRequest = vi.fn().mockResolvedValue(makeResponse('content'));
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({ url: 'https://docs.mapbox.com/page' });

      expect(result.isError).toBe(false);
    });
  });

  describe('caching', () => {
    it('returns cached content without an HTTP request', async () => {
      docCache.set('https://docs.mapbox.com/page', 'cached content');
      const httpRequest = vi.fn();
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({ url: 'https://docs.mapbox.com/page' });

      expect(result.isError).toBe(false);
      expect((result.content[0] as { text: string }).text).toBe(
        'cached content'
      );
      expect(httpRequest).not.toHaveBeenCalled();
    });
  });

  describe('redirects', () => {
    it('returns an error and does not cache when the server answers with a redirect', async () => {
      const httpRequest = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/other' }
        })
      );
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({ url: 'https://docs.mapbox.com/page' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toMatch(
        /Redirect not followed/
      );
      expect(docCache.get('https://docs.mapbox.com/page')).toBeNull();
    });
  });

  describe('HTTP errors', () => {
    it('returns an error on non-ok response', async () => {
      const httpRequest = vi
        .fn()
        .mockResolvedValue(
          new Response('Not Found', { status: 404, statusText: 'Not Found' })
        );
      const tool = new GetDocumentTool({ httpRequest });

      const result = await tool.run({ url: 'https://docs.mapbox.com/missing' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toMatch(
        /Failed to fetch/
      );
    });
  });
});
