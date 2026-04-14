// Copyright (c) Mapbox, Inc.
// Licensed under the MIT License.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  type Span,
  diag,
  DiagLogLevel
} from '@opentelemetry/api';
import { ATTR_SERVICE_INSTANCE_ID } from '@opentelemetry/semantic-conventions/incubating';
import { getVersionInfo } from './versionUtils.js';

// Suppress OpenTelemetry diagnostic logging IMMEDIATELY to avoid polluting stdio.
// This must happen at module load time, before any OTEL operations.
// Use OTEL_LOG_LEVEL env var to override if needed for debugging.
const configureOtelDiagnostics = () => {
  const logLevel = process.env.OTEL_LOG_LEVEL
    ? DiagLogLevel[
        process.env.OTEL_LOG_LEVEL.toUpperCase() as keyof typeof DiagLogLevel
      ]
    : DiagLogLevel.NONE;

  diag.setLogger(
    {
      verbose: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    },
    logLevel
  );
};

configureOtelDiagnostics();

let sdk: NodeSDK | null = null;
let isTracingEnabled = false;

/**
 * Initialize OpenTelemetry tracing. Call once at application startup.
 * No-ops in test environments or when OTEL_TRACING_ENABLED=false.
 */
export async function initializeTracing(): Promise<void> {
  if (sdk || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }

  if (process.env.OTEL_TRACING_ENABLED === 'false') {
    return;
  }

  const versionInfo = getVersionInfo();

  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || versionInfo.name,
      [ATTR_SERVICE_VERSION]: versionInfo.version,
      [ATTR_SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
      'service.git.sha': versionInfo.sha,
      'service.git.branch': versionInfo.branch,
      'service.git.tag': versionInfo.tag
    });

    const exporters = [];

    if (process.env.OTEL_EXPORTER_CONSOLE_ENABLED === 'true') {
      const { ConsoleSpanExporter } =
        await import('@opentelemetry/sdk-trace-base');
      exporters.push(new ConsoleSpanExporter());
    }

    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (otlpEndpoint) {
      exporters.push(
        new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
            ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
            : {}
        })
      );
    }

    if (exporters.length === 0) {
      return;
    }

    sdk = new NodeSDK({
      resource,
      traceExporter: exporters[0],
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-undici': { enabled: true }
        })
      ]
    });

    sdk.start();
    isTracingEnabled = true;
  } catch {
    // Silently handle initialization errors to avoid breaking MCP stdio
    isTracingEnabled = false;
  }
}

/**
 * Shutdown tracing gracefully. Call on process exit.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    isTracingEnabled = false;
  }
}

export function isTracingInitialized(): boolean {
  return isTracingEnabled;
}

export function getTracer() {
  return trace.getTracer('mapbox-mcp-docs-server');
}

/**
 * Create a span for tool execution and run the callback within its context.
 * Automatically marks the span success or error and ends it.
 */
export async function withToolSpan<T>(
  toolName: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`tool.${toolName}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'tool.name': toolName,
      'operation.type': 'tool_execution'
    }
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) {
        span.recordException(error);
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      throw error;
    } finally {
      span.end();
    }
  });
}
