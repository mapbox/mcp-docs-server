// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseToolConfigFromArgs, filterTools } from './config/toolConfig.js';
import { getCoreTools } from './tools/toolRegistry.js';
import { getAllResources } from './resources/resourceRegistry.js';
import { getVersionInfo } from './utils/versionUtils.js';

// Parse configuration from command-line arguments
const config = parseToolConfigFromArgs();

// Get and filter tools based on configuration
const coreTools = getCoreTools();
const enabledCoreTools = filterTools(coreTools, config);

const versionInfo = getVersionInfo();

// Create an MCP server
const server = new McpServer(
  {
    name: versionInfo.name,
    version: versionInfo.version
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Register tools
enabledCoreTools.forEach((tool) => {
  tool.installTo(server);
});

// Register resources
const resources = getAllResources();
resources.forEach((resource) => {
  resource.installTo(server);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  server.server.sendLoggingMessage({
    level: 'info',
    data: `${versionInfo.name} v${versionInfo.version} started`
  });
}

async function shutdown() {
  try {
    server.server.sendLoggingMessage({
      level: 'info',
      data: 'Server shutting down gracefully'
    });
  } catch {
    // Ignore logging errors during shutdown
  }
  process.exit(0);
}

function exitWithError(error: unknown, code = 1) {
  try {
    server.server.sendLoggingMessage({
      level: 'error',
      data: `Fatal error: ${error instanceof Error ? error.message : String(error)}`
    });
  } catch {
    console.error('Fatal error:', error);
  }
  process.exit(code);
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    try {
      await shutdown();
    } finally {
      process.exit(0);
    }
  });
});

process.on('uncaughtException', (err) => exitWithError(err));
process.on('unhandledRejection', (reason) => exitWithError(reason));

main().catch((error) => exitWithError(error));
