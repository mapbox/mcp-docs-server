// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { z } from 'zod';

export const SearchDocsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Search query for Mapbox documentation (e.g. "add a marker", "camera animation", "geocoding API").'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Maximum number of results to return (1–20, default 5).')
});

export type SearchDocsInput = z.infer<typeof SearchDocsSchema>;
