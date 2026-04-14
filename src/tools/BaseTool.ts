// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import {
  McpServer,
  RegisteredTool
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  CallToolResult,
  ToolAnnotations
} from '@modelcontextprotocol/sdk/types.js';
import { z, ZodTypeAny } from 'zod';
import { withToolSpan } from '../utils/tracing.js';

export abstract class BaseTool<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny = ZodTypeAny
> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly annotations: ToolAnnotations;

  readonly inputSchema: InputSchema;
  readonly outputSchema?: OutputSchema;
  protected server: McpServer | null = null;

  constructor(params: {
    inputSchema: InputSchema;
    outputSchema?: OutputSchema;
  }) {
    this.inputSchema = params.inputSchema;
    this.outputSchema = params.outputSchema;
  }

  /**
   * Tool logic to be implemented by subclasses.
   */
  async run(
    rawInput: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _extra?: RequestHandlerExtra<any, any>
  ): Promise<CallToolResult> {
    return withToolSpan(this.name, async (span) => {
      try {
        const input = this.inputSchema.parse(rawInput);
        const result = await this.execute(input);
        if (result.isError) {
          span.setAttribute('tool.error', true);
        }
        return result;
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: (error as Error).message }]
        };
      }
    });
  }

  protected abstract execute(
    inputSchema: z.infer<InputSchema>
  ): Promise<CallToolResult>;

  /**
   * Installs the tool to the given MCP server.
   */
  installTo(server: McpServer): RegisteredTool {
    this.server = server;

    const config: {
      title?: string;
      description?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outputSchema?: any;
      annotations?: ToolAnnotations;
    } = {
      title: this.annotations.title,
      description: this.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: (this.inputSchema as unknown as z.ZodObject<any>).shape,
      annotations: this.annotations
    };

    // Add outputSchema if provided
    if (this.outputSchema) {
      config.outputSchema =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.outputSchema as unknown as z.ZodObject<any>).shape;
    }

    return server.registerTool(
      this.name,
      config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any, extra: any) => this.run(args, extra)
    );
  }

  /**
   * Helper method to send logging messages
   */
  protected log(
    level: 'debug' | 'info' | 'warning' | 'error',
    data: string | Record<string, unknown>
  ): void {
    if (this.server?.server) {
      this.server.server.sendLoggingMessage({ level, data });
    }
  }
}
