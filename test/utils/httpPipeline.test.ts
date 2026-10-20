// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  HttpPipeline,
  NoRedirectPolicy,
  RetryPolicy,
  systemHttpPipeline
} from '../../src/utils/httpPipeline.js';

function listen(
  handler: Parameters<typeof createServer>[1]
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: (server.address() as AddressInfo).port })
    );
  });
}

describe('NoRedirectPolicy', () => {
  const servers: Server[] = [];
  afterEach(() => {
    servers.splice(0).forEach((s) => s.close());
  });

  it('does not request the redirect target (real fetch, two local servers)', async () => {
    const target = vi.fn();
    const second = await listen((_req, res) => {
      target();
      res.end('target');
    });
    const first = await listen((_req, res) => {
      res.writeHead(302, { location: `http://127.0.0.1:${second.port}/` });
      res.end();
    });
    servers.push(first.server, second.server);

    const pipeline = new HttpPipeline();
    pipeline.usePolicy(new NoRedirectPolicy());
    const response = await pipeline.execute(`http://127.0.0.1:${first.port}/`);

    expect(response.status).toBe(302);
    expect(target).not.toHaveBeenCalled();
  });

  it('overrides redirect: follow on a Request input', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('ok'));
    const pipeline = new HttpPipeline(impl);
    pipeline.usePolicy(new NoRedirectPolicy());

    await pipeline.execute(
      new Request('https://docs.mapbox.com/', { redirect: 'follow' }),
      {}
    );

    expect(impl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('sets redirect: manual when the caller sets nothing', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('ok'));
    const pipeline = new HttpPipeline(impl);
    pipeline.usePolicy(new NoRedirectPolicy());

    await pipeline.execute('https://docs.mapbox.com/', {});

    expect(impl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('overrides a caller-supplied redirect: follow', async () => {
    const impl = vi.fn().mockResolvedValue(new Response('ok'));
    const pipeline = new HttpPipeline(impl);
    pipeline.usePolicy(new NoRedirectPolicy());

    await pipeline.execute('https://docs.mapbox.com/', { redirect: 'follow' });

    expect(impl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('returns a 3xx response without a second request or retry', async () => {
    const impl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/other' }
      })
    );
    const pipeline = new HttpPipeline(impl);
    pipeline.usePolicy(new RetryPolicy(3, 1, 1));
    pipeline.usePolicy(new NoRedirectPolicy());

    const response = await pipeline.execute('https://docs.mapbox.com/', {});

    expect(response.status).toBe(302);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('is registered on the shared system pipeline', () => {
    expect(
      systemHttpPipeline.findPolicyById('system-no-redirect-policy')
    ).toBeInstanceOf(NoRedirectPolicy);
  });
});
