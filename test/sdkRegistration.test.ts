// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { describe, it, expect, vi } from 'vitest';
import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { getAllTools } from '../src/tools/toolRegistry.js';
import { getAllResources } from '../src/resources/resourceRegistry.js';
import { GetDocumentTool } from '../src/tools/get-document-tool/GetDocumentTool.js';

/**
 * The tool tests call run() directly, so these go through a real McpServer to
 * check that tools and resources still register and answer on the SDK.
 */
async function connect(install: (server: McpServer) => void) {
  const server = new McpServer(
    { name: 'test', version: '0.0.0' },
    { capabilities: { tools: {}, resources: {}, logging: {} } }
  );
  install(server);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);
  return client;
}

describe('SDK registration', () => {
  it('lists every tool and resource with its schema', async () => {
    const client = await connect((server) => {
      getAllTools().forEach((tool) => tool.installTo(server));
      getAllResources().forEach((resource) => resource.installTo(server));
    });

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      getAllTools()
        .map((tool) => tool.name)
        .sort()
    );
    const getDocument = tools.find((tool) => tool.name === 'get_document_tool');
    expect(getDocument?.inputSchema).toMatchObject({
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    });

    const { resources } = await client.listResources();
    expect(resources).toHaveLength(getAllResources().length);
    await client.close();
  });

  it('runs a tool through tools/call', async () => {
    const httpRequest = vi.fn();
    const client = await connect((server) =>
      new GetDocumentTool({ httpRequest }).installTo(server)
    );

    const result = (await client.request({
      method: 'tools/call',
      params: {
        name: 'get_document_tool',
        arguments: { url: 'https://evil.com/page' }
      }
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(httpRequest).not.toHaveBeenCalled();
    await client.close();
  });

  it('reads a static resource through resources/read', async () => {
    const client = await connect((server) =>
      getAllResources().forEach((resource) => resource.installTo(server))
    );

    const { resources } = await client.listResources();
    const tokenScopes = resources.find((resource) =>
      resource.uri.includes('token-scopes')
    );
    expect(tokenScopes).toBeDefined();
    const { contents } = await client.readResource({ uri: tokenScopes!.uri });
    expect('text' in contents[0] && contents[0].text).toBeTruthy();
    await client.close();
  });
});
