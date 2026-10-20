// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, afterEach } from 'vitest';
import { isDocsUrl, hasAccessToken } from '../../src/utils/docUrl.js';

afterEach(() => {
  delete process.env.MAPBOX_DOCS_HOST_OVERRIDE;
});

describe('isDocsUrl', () => {
  it.each([
    'https://docs.mapbox.com/',
    'https://docs.mapbox.com/api/overview/',
    'https://docs.mapbox.com/llms.txt?x=1'
  ])('accepts %s', (url) => {
    expect(isDocsUrl(url)).toBe(true);
  });

  it.each([
    'http://docs.mapbox.com/',
    'https://mapbox.com/about',
    'https://www.mapbox.com/',
    'https://api.mapbox.com/styles/v1/a/b',
    'https://docs.mapbox.com:8080/',
    'https://user:pass@docs.mapbox.com/',
    'https://docs.mapbox.com.example.com/',
    'https://docs.mapbox.com./',
    'https://example.com/docs.mapbox.com',
    'https://192.0.2.1/',
    'https://example.com/other',
    'https://docs.tilestream.net/',
    'file:///tmp/x',
    'not a url'
  ])('rejects %s', (url) => {
    expect(isDocsUrl(url)).toBe(false);
  });

  it('accepts the staging host only when MAPBOX_DOCS_HOST_OVERRIDE is set', () => {
    expect(isDocsUrl('https://docs.tilestream.net/')).toBe(false);
    process.env.MAPBOX_DOCS_HOST_OVERRIDE = 'docs.tilestream.net';
    expect(isDocsUrl('https://docs.tilestream.net/')).toBe(true);
  });
});

describe('hasAccessToken', () => {
  it('detects access_token in the query string', () => {
    expect(hasAccessToken('https://docs.mapbox.com/p?access_token=pk.x')).toBe(
      true
    );
    expect(hasAccessToken('https://docs.mapbox.com/p?a=1')).toBe(false);
    expect(hasAccessToken('https://docs.mapbox.com/p?ACCESS_TOKEN=x')).toBe(
      true
    );
    expect(hasAccessToken('https://docs.mapbox.com/p?Access_Token=x')).toBe(
      true
    );
  });
});
