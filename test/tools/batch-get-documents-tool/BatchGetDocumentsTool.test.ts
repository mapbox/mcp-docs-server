// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchGetDocumentsTool } from '../../../src/tools/batch-get-documents-tool/BatchGetDocumentsTool.js';
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

describe('BatchGetDocumentsTool', () => {
  describe('intra-batch URL deduplication', () => {
    it('issues only one HTTP request for multiple URLs with the same normalized key', async () => {
      const httpRequest = vi
        .fn()
        .mockResolvedValue(makeResponse('page content'));
      const tool = new BatchGetDocumentsTool({ httpRequest });

      const urls = [
        'https://docs.mapbox.com/page?bust=1',
        'https://docs.mapbox.com/page?bust=2',
        'https://docs.mapbox.com/page?bust=3'
      ];

      const result = await tool.run({ urls });

      expect(httpRequest).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(false);

      const output = JSON.parse((result.content[0] as { text: string }).text);
      expect(output).toHaveLength(3);
      expect(
        output.every((r: { content: string }) => r.content === 'page content')
      ).toBe(true);
    });

    it('issues one request per distinct normalized URL', async () => {
      const httpRequest = vi
        .fn()
        .mockResolvedValueOnce(makeResponse('page A'))
        .mockResolvedValueOnce(makeResponse('page B'));
      const tool = new BatchGetDocumentsTool({ httpRequest });

      const urls = [
        'https://docs.mapbox.com/a?x=1',
        'https://docs.mapbox.com/a?x=2',
        'https://docs.mapbox.com/b?x=1'
      ];

      const result = await tool.run({ urls });

      expect(httpRequest).toHaveBeenCalledTimes(2);
      expect(result.isError).toBe(false);

      const output = JSON.parse((result.content[0] as { text: string }).text);
      expect(output[0].content).toBe('page A');
      expect(output[1].content).toBe('page A');
      expect(output[2].content).toBe('page B');
    });

    it('uses cached content and skips fetch for already-cached normalized URL', async () => {
      docCache.set('https://docs.mapbox.com/page', 'cached content');
      const httpRequest = vi.fn();
      const tool = new BatchGetDocumentsTool({ httpRequest });

      const result = await tool.run({
        urls: [
          'https://docs.mapbox.com/page?bust=1',
          'https://docs.mapbox.com/page?bust=2'
        ]
      });

      expect(httpRequest).not.toHaveBeenCalled();
      const output = JSON.parse((result.content[0] as { text: string }).text);
      expect(
        output.every((r: { content: string }) => r.content === 'cached content')
      ).toBe(true);
    });
  });

  describe('response body size limit', () => {
    it('returns an error for a URL whose Content-Length exceeds the limit', async () => {
      const oversizeHeaders = new Headers({
        'content-type': 'text/plain',
        'content-length': String(6 * 1024 * 1024) // 6 MB > 5 MB limit
      });
      const httpRequest = vi
        .fn()
        .mockResolvedValue(
          new Response('x', { status: 200, headers: oversizeHeaders })
        );
      const tool = new BatchGetDocumentsTool({ httpRequest });

      const result = await tool.run({
        urls: ['https://docs.mapbox.com/page']
      });

      expect(result.isError).toBe(false); // batch doesn't fail entirely
      const output = JSON.parse((result.content[0] as { text: string }).text);
      expect(output[0].error).toMatch(/too large/i);
    });
  });

  describe('invalid URLs', () => {
    it('rejects non-mapbox URLs', async () => {
      const httpRequest = vi.fn();
      const tool = new BatchGetDocumentsTool({ httpRequest });

      const result = await tool.run({
        urls: ['https://evil.com/page']
      });

      expect(result.isError).toBe(true);
      expect(httpRequest).not.toHaveBeenCalled();
    });
  });

  describe('HTTP errors', () => {
    it('returns per-URL error on non-ok response', async () => {
      const httpRequest = vi
        .fn()
        .mockResolvedValue(
          new Response('Not Found', { status: 404, statusText: 'Not Found' })
        );
      const tool = new BatchGetDocumentsTool({ httpRequest });

      const result = await tool.run({
        urls: ['https://docs.mapbox.com/missing']
      });

      expect(result.isError).toBe(false);
      const output = JSON.parse((result.content[0] as { text: string }).text);
      expect(output[0].error).toBe('404 Not Found');
    });
  });
});
