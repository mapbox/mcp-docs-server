// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

/**
 * HttpRequest interface
 */
export interface HttpRequest {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}
