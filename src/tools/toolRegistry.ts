// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { ZodTypeAny } from 'zod';
import { BaseTool } from './BaseTool.js';
import { BatchGetDocumentsTool } from './batch-get-documents-tool/BatchGetDocumentsTool.js';
import { GetDocumentTool } from './get-document-tool/GetDocumentTool.js';
import { GetDocsIndexTool } from './get-docs-index-tool/GetDocsIndexTool.js';
import { SearchDocsTool } from './search-docs-tool/SearchDocsTool.js';
import { httpRequest } from '../utils/httpPipeline.js';

export type ToolInstance = BaseTool<ZodTypeAny>;

/**
 * Core tools registered for all MCP clients
 */
export const CORE_TOOLS: ToolInstance[] = [
  new GetDocumentTool({ httpRequest }),
  new BatchGetDocumentsTool({ httpRequest }),
  new GetDocsIndexTool({ httpRequest }),
  new SearchDocsTool({ httpRequest })
];

export const ALL_TOOLS: ToolInstance[] = [...CORE_TOOLS];

export function getCoreTools(): readonly ToolInstance[] {
  return CORE_TOOLS;
}

export function getAllTools(): readonly ToolInstance[] {
  return ALL_TOOLS;
}

export function getToolByName(name: string): ToolInstance | undefined {
  return ALL_TOOLS.find((tool) => tool.name === name);
}
