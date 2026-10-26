// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

// CommonJS build of versionUtils.ts. tshy uses this file in place of
// versionUtils.ts for dist/commonjs, since import.meta doesn't exist there.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface VersionInfo {
  name: string;
  version: string;
  sha: string;
  tag: string;
  branch: string;
}

export function getVersionInfo(): VersionInfo {
  const name = 'Mapbox Documentation MCP Server';
  try {
    const filePath = path.resolve(__dirname, '..', 'version.json');
    const data = readFileSync(filePath, 'utf-8');
    const info = JSON.parse(data) as VersionInfo;
    info.name = name;
    return info;
  } catch {
    return {
      name: name,
      version: '0.0.0',
      sha: 'unknown',
      tag: 'unknown',
      branch: 'unknown'
    };
  }
}
