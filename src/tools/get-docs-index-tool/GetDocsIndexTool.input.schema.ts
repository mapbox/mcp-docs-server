// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { z } from 'zod';

export const PRODUCT_SOURCES = {
  'api-reference': {
    url: 'https://docs.mapbox.com/api/llms.txt',
    label: 'Mapbox REST API Reference'
  },
  'mapbox-gl-js': {
    url: 'https://docs.mapbox.com/mapbox-gl-js/llms.txt',
    label: 'Mapbox GL JS'
  },
  'help-guides': {
    url: 'https://docs.mapbox.com/help/llms.txt',
    label: 'Help Center & Guides'
  },
  'style-spec': {
    url: 'https://docs.mapbox.com/style-spec/llms.txt',
    label: 'Style Specification'
  },
  'studio-manual': {
    url: 'https://docs.mapbox.com/studio-manual/llms.txt',
    label: 'Mapbox Studio Manual'
  },
  'search-js': {
    url: 'https://docs.mapbox.com/mapbox-search-js/llms.txt',
    label: 'Mapbox Search JS'
  },
  'ios-maps': {
    url: 'https://docs.mapbox.com/ios/maps/llms.txt',
    label: 'Maps SDK for iOS'
  },
  'android-maps': {
    url: 'https://docs.mapbox.com/android/maps/llms.txt',
    label: 'Maps SDK for Android'
  },
  'ios-navigation': {
    url: 'https://docs.mapbox.com/ios/navigation/llms.txt',
    label: 'Navigation SDK for iOS'
  },
  'android-navigation': {
    url: 'https://docs.mapbox.com/android/navigation/llms.txt',
    label: 'Navigation SDK for Android'
  },
  'tiling-service': {
    url: 'https://docs.mapbox.com/mapbox-tiling-service/llms.txt',
    label: 'Mapbox Tiling Service'
  },
  tilesets: {
    url: 'https://docs.mapbox.com/data/tilesets/llms.txt',
    label: 'Tilesets'
  },
  catalog: {
    url: 'https://docs.mapbox.com/llms.txt',
    label: 'Full Product Catalog'
  }
} as const;

export type ProductKey = keyof typeof PRODUCT_SOURCES;

export const GetDocsIndexSchema = z.object({
  product: z
    .enum(Object.keys(PRODUCT_SOURCES) as [ProductKey, ...ProductKey[]])
    .describe(
      'Which Mapbox documentation index to fetch. ' +
        'Use "catalog" to discover all available products and their llms.txt URLs. ' +
        "Use a specific product key to get a structured index of that product's pages."
    )
});

export type GetDocsIndexInput = z.infer<typeof GetDocsIndexSchema>;
