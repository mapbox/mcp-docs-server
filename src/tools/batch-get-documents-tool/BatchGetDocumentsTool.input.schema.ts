// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { z } from 'zod';

export const BatchGetDocumentsSchema = z.object({
  urls: z
    .array(z.string().url())
    .min(1)
    .max(20)
    .describe(
      'Array of Mapbox documentation page URLs to fetch (max 20). All must be mapbox.com URLs.'
    )
});

export type BatchGetDocumentsInput = z.infer<typeof BatchGetDocumentsSchema>;
