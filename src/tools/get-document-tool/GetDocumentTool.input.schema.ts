// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { z } from 'zod';

export const GetDocumentSchema = z.object({
  url: z
    .string()
    .url()
    .describe(
      'URL of a Mapbox documentation page to fetch. Must be a mapbox.com URL (e.g. https://docs.mapbox.com/api/search/geocoding/).'
    )
});

export type GetDocumentInput = z.infer<typeof GetDocumentSchema>;
