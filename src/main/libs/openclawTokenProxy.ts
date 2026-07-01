import { net } from 'electron';
import http from 'http';

import { isLobsterAIQuotaExhaustedError } from '../../common/coworkErrorClassify';

import type { ServerModelMetadata } from './claudeSettings';
import { buildOpenAIChatCompletionsURL } from './coworkFormatTransform';

const PROXY_BIND_HOST = '127.0.0.1';
const RECENT_QUOTA_ERROR_TTL_MS = 30_000;

let proxyServer: http.Server | null = null;
let proxyPort: number | null = null;
let recentQuotaError: OpenClawTokenProxyQuotaError | null = null;

// Injected dependencies
let tokenGetter: (() => { accessToken: string; refreshToken: string } | null) | null = null;
let tokenRefresher: ((reason: string) => Promise<string | null>) | null = null;
let serverBaseUrlGetter: (() => string) | null = null;
let serverModelMetadataGetter: (() => ServerModelMetadata[]) | null = null;

export type OpenClawTokenProxyConfig = {
  getAuthTokens: () => { accessToken: string; refreshToken: string } | null;
  refreshToken: (reason: string) => Promise<string | null>;
  getServerBaseUrl: () => string;
  getServerModelMetadata: () => ServerModelMetadata[];
};

type OpenClawTokenProxyQuotaError = {
  message: string;
  code?: string | number;
  capturedAt: number;
};

export function startOpenClawTokenProxy(config: OpenClawTokenProxyConfig): Promise<{ port: number }> {
  tokenGetter = config.getAuthTokens;
  tokenRefresher = config.refreshToken;
  serverBaseUrlGetter = config.getServerBaseUrl;
  serverModelMetadataGetter = config.getServerModelMetadata;

  return new Promise((resolve, reject) => {
    if (proxyServer) {
      if (proxyPort) {
        resolve({ port: proxyPort });
        return;
      }
      reject(new Error('Token proxy is starting'));
      return;
    }

    const server = http.createServer(handleRequest);

    server.listen(0, PROXY_BIND_HOST, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        proxyPort = addr.port;
        proxyServer = server;
        console.log(`[OpenClawTokenProxy] started on ${PROXY_BIND_HOST}:${proxyPort}`);
        resolve({ port: proxyPort });
      } else {
        server.close();
        reject(new Error('Failed to bind token proxy'));
      }
    });

    server.on('error', (err) => {
      console.error('[OpenClawTokenProxy] server error:', err);
      reject(err);
    });
  });
}

export function stopOpenClawTokenProxy(): void {
  if (proxyServer) {
    proxyServer.close();
    proxyServer = null;
    proxyPort = null;
    recentQuotaError = null;
    console.log('[OpenClawTokenProxy] stopped');
  }
}

export function getOpenClawTokenProxyPort(): number | null {
  return proxyPort;
}

export function consumeRecentOpenClawTokenProxyQuotaError(
  now = Date.now(),
): OpenClawTokenProxyQuotaError | null {
  const error = recentQuotaError;
  recentQuotaError = null;
  if (!error) {
    return null;
  }
  if (now - error.capturedAt > RECENT_QUOTA_ERROR_TTL_MS) {
    return null;
  }
  return error;
}

function collectRequestBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

type UpstreamRoute = {
  modelId: string | null;
  source: 'direct' | 'fallback';
  url: string;
  authToken: string;
};

export type OpenClawUpstreamRouteDecision = UpstreamRoute;

type DirectModelRoute = {
  modelId: string;
  apiBaseUrl: string;
  apiKey: string;
};

export const maskTokenForLog = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***`;
  }
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-2)}`;
};

export const parseModelIdFromOpenAIRequestBody = (body: Buffer): string | null => {
  if (body.length === 0) return null;
  try {
    const parsed = JSON.parse(body.toString('utf8')) as { model?: unknown };
    if (typeof parsed.model !== 'string') {
      return null;
    }
    const modelId = parsed.model.trim();
    return modelId || null;
  } catch {
    return null;
  }
};

export const resolveDirectOpenAIRouteForModel = (
  modelId: string | null,
  models: ServerModelMetadata[],
): DirectModelRoute | null => {
  if (!modelId) return null;
  const matchedModel = models.find((model) => model.modelId === modelId);
  if (!matchedModel) return null;

  const apiBaseUrl = matchedModel.apiBaseUrl?.trim() || '';
  const apiKey = matchedModel.apiKey?.trim() || '';
  if (!apiBaseUrl || !apiKey) return null;

  return {
    modelId: matchedModel.modelId,
    apiBaseUrl,
    apiKey,
  };
};

export const resolveOpenClawUpstreamRoute = (options: {
  requestUrl?: string;
  body: Buffer;
  fallbackAccessToken: string;
  serverBaseUrl: string;
  models: ServerModelMetadata[];
}): OpenClawUpstreamRouteDecision => {
  const { requestUrl, body, fallbackAccessToken, serverBaseUrl, models } = options;
  const modelId = parseModelIdFromOpenAIRequestBody(body);
  const directRoute = resolveDirectOpenAIRouteForModel(
    modelId,
    models,
  );
  if (directRoute) {
    const directUrl = buildOpenAIChatCompletionsURL(directRoute.apiBaseUrl);
    return {
      modelId: directRoute.modelId,
      source: 'direct',
      url: directUrl,
      authToken: directRoute.apiKey,
    };
  }

  const upstreamPath = `/api/proxy${requestUrl || '/'}`;
  return {
    modelId,
    source: 'fallback',
    url: `${serverBaseUrl}${upstreamPath}`,
    authToken: fallbackAccessToken,
  };
};

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const tokens = tokenGetter?.();
    const serverBaseUrl = serverBaseUrlGetter?.();

    if (!tokens?.accessToken || !serverBaseUrl) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No auth tokens available' }));
      return;
    }

    const body = await collectRequestBody(req);

    const upstreamRoute = resolveOpenClawUpstreamRoute({
      requestUrl: req.url,
      body,
      fallbackAccessToken: tokens.accessToken,
      serverBaseUrl,
      models: serverModelMetadataGetter?.() ?? [],
    });
    console.log('[OpenClawTokenProxy] forwarding request', {
      modelId: upstreamRoute.modelId,
      source: upstreamRoute.source,
      upstreamUrl: upstreamRoute.url,
      authToken: maskTokenForLog(upstreamRoute.authToken),
    });

    const result = await forwardRequest(
      upstreamRoute.url,
      req.method || 'POST',
      upstreamRoute.authToken,
      body,
      req.headers,
    );

    if (
      upstreamRoute.source === 'fallback'
      && (result.status === 401 || result.status === 403)
      && tokenRefresher
    ) {
      console.log(`[OpenClawTokenProxy] received ${result.status}, attempting token refresh`);
      const newToken = await tokenRefresher('openclaw-proxy');
      if (newToken) {
        const retryResult = await forwardRequest(
          upstreamRoute.url,
          req.method || 'POST',
          newToken,
          body,
          req.headers,
        );
        pipeResponse(retryResult, res);
        return;
      }
    }

    pipeResponse(result, res);
  } catch (err) {
    console.error('[OpenClawTokenProxy] request handling error:', err);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token proxy upstream error' }));
    }
  }
}

type UpstreamResult = {
  status: number;
  headers: Record<string, string>;
  body: NodeJS.ReadableStream | Buffer;
  isStream: boolean;
};

type ParsedProxySSEPacket = {
  event: string;
  payload: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getErrorMessage(value: Record<string, unknown>): string {
  const nestedError = value.error;
  if (isRecord(nestedError) && typeof nestedError.message === 'string') {
    return nestedError.message;
  }
  if (typeof value.message === 'string') {
    return value.message;
  }
  return '';
}

function getErrorCode(value: Record<string, unknown>): string | number | undefined {
  const nestedError = value.error;
  if (
    isRecord(nestedError)
    && (typeof nestedError.code === 'string' || typeof nestedError.code === 'number')
  ) {
    return nestedError.code;
  }
  if (typeof value.code === 'string' || typeof value.code === 'number') {
    return value.code;
  }
  return undefined;
}

function parseProxySSEPacket(packet: string): ParsedProxySSEPacket {
  const lines = packet.split(/\r?\n/);
  const dataLines: string[] = [];
  let event = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trimStart();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return {
    event,
    payload: dataLines.join('\n'),
  };
}

function findSSEPacketBoundary(buffer: string): { index: number; separatorLength: number } | null {
  const match = /\r?\n\r?\n/.exec(buffer);
  if (!match || typeof match.index !== 'number') {
    return null;
  }
  return {
    index: match.index,
    separatorLength: match[0].length,
  };
}

function extractQuotaErrorFromProxyErrorPayload(
  payload: string,
  event = '',
): Omit<OpenClawTokenProxyQuotaError, 'capturedAt'> | null {
  if (!payload || payload === '[DONE]') {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const message = getErrorMessage(parsed);
    const code = getErrorCode(parsed);
    const isErrorPayload = event === 'error' || parsed.type === 'error' || parsed.error != null;
    const searchable = `${message} ${code ?? ''} ${payload}`;
    if (isErrorPayload && isLobsterAIQuotaExhaustedError(searchable)) {
      return {
        message: message || payload,
        ...(code !== undefined ? { code } : {}),
      };
    }
  } catch {
    if (event === 'error' && isLobsterAIQuotaExhaustedError(payload)) {
      return { message: payload };
    }
  }

  return null;
}

function extractQuotaErrorFromProxySSEPacket(
  packet: string,
): Omit<OpenClawTokenProxyQuotaError, 'capturedAt'> | null {
  const parsed = parseProxySSEPacket(packet);
  return extractQuotaErrorFromProxyErrorPayload(parsed.payload, parsed.event);
}

function rememberQuotaError(error: Omit<OpenClawTokenProxyQuotaError, 'capturedAt'>, now = Date.now()): void {
  recentQuotaError = {
    ...error,
    capturedAt: now,
  };
}

function scanProxySSEBufferForQuotaError(buffer: string, now = Date.now()): string {
  let remaining = buffer;
  let boundary = findSSEPacketBoundary(remaining);

  while (boundary) {
    const packet = remaining.slice(0, boundary.index);
    remaining = remaining.slice(boundary.index + boundary.separatorLength);

    const quotaError = extractQuotaErrorFromProxySSEPacket(packet);
    if (quotaError) {
      rememberQuotaError(quotaError, now);
    }

    boundary = findSSEPacketBoundary(remaining);
  }

  return remaining;
}

function flushProxySSEBufferForQuotaError(buffer: string, now = Date.now()): void {
  const remaining = scanProxySSEBufferForQuotaError(buffer, now);
  if (!remaining.trim()) {
    return;
  }
  const quotaError = extractQuotaErrorFromProxySSEPacket(remaining);
  if (quotaError) {
    rememberQuotaError(quotaError, now);
  }
}

function scanProxyBodyForQuotaError(body: Buffer, now = Date.now()): void {
  const text = body.toString('utf8');
  const quotaError = extractQuotaErrorFromProxyErrorPayload(text);
  if (quotaError) {
    rememberQuotaError(quotaError, now);
  }
}

async function forwardRequest(
  url: string,
  method: string,
  accessToken: string,
  body: Buffer,
  incomingHeaders: http.IncomingHttpHeaders,
): Promise<UpstreamResult> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': incomingHeaders['content-type'] || 'application/json',
  };

  // Forward accept header for SSE streaming
  if (incomingHeaders.accept) {
    headers['Accept'] = incomingHeaders.accept;
  }

  const resp = await net.fetch(url, {
    method,
    headers,
    body: body.length > 0 ? new Uint8Array(body) : undefined,
  });

  const contentType = resp.headers.get('content-type') || '';
  const isStream = contentType.includes('text/event-stream');

  const responseHeaders: Record<string, string> = {};
  resp.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  if (isStream && resp.body) {
    return {
      status: resp.status,
      headers: responseHeaders,
      body: resp.body as unknown as NodeJS.ReadableStream,
      isStream: true,
    };
  }

  const respBuffer = Buffer.from(await resp.arrayBuffer());
  return {
    status: resp.status,
    headers: responseHeaders,
    body: respBuffer,
    isStream: false,
  };
}

function pipeResponse(result: UpstreamResult, res: http.ServerResponse): void {
  res.writeHead(result.status, result.headers);

  if (result.isStream) {
    pipeStreamingResponseWithQuotaScan(result.body, res);
  } else if (Buffer.isBuffer(result.body)) {
    scanProxyBodyForQuotaError(result.body);
    res.end(result.body);
  } else {
    pipeWebReadableResponseWithQuotaScan(result.body as unknown as ReadableStream<Uint8Array>, res);
  }
}

function isNodeReadableStream(body: unknown): body is NodeJS.ReadableStream {
  return Boolean(
    body
    && typeof body === 'object'
    && typeof (body as NodeJS.ReadableStream).on === 'function',
  );
}

function pipeStreamingResponseWithQuotaScan(
  body: NodeJS.ReadableStream | Buffer,
  res: http.ServerResponse,
): void {
  if (Buffer.isBuffer(body)) {
    scanProxyBodyForQuotaError(body);
    res.end(body);
    return;
  }

  if (isNodeReadableStream(body)) {
    pipeNodeReadableResponseWithQuotaScan(body, res);
    return;
  }

  pipeWebReadableResponseWithQuotaScan(body as unknown as ReadableStream<Uint8Array>, res);
}

function pipeNodeReadableResponseWithQuotaScan(
  stream: NodeJS.ReadableStream,
  res: http.ServerResponse,
): void {
  const decoder = new TextDecoder();
  let sseBuffer = '';

  stream.on('data', (chunk: Buffer | Uint8Array | string) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    sseBuffer = scanProxySSEBufferForQuotaError(
      sseBuffer + decoder.decode(buffer, { stream: true }),
    );
    res.write(buffer);
  });

  stream.on('end', () => {
    const tail = decoder.decode();
    flushProxySSEBufferForQuotaError(sseBuffer + tail);
    res.end();
  });

  stream.on('error', (err) => {
    console.error('[OpenClawTokenProxy] stream read error:', err);
    res.end();
  });
}

function pipeWebReadableResponseWithQuotaScan(
  webStream: ReadableStream<Uint8Array>,
  res: http.ServerResponse,
): void {
  const reader = webStream.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

  const pump = (): void => {
    reader.read().then(({ done, value }) => {
      if (done) {
        const tail = decoder.decode();
        flushProxySSEBufferForQuotaError(sseBuffer + tail);
        res.end();
        return;
      }

      sseBuffer = scanProxySSEBufferForQuotaError(
        sseBuffer + decoder.decode(value, { stream: true }),
      );
      res.write(value);
      pump();
    }).catch((err) => {
      console.error('[OpenClawTokenProxy] stream read error:', err);
      res.end();
    });
  };

  pump();
}

export const __openClawTokenProxyTestUtils = {
  extractQuotaErrorFromProxyErrorPayload,
  extractQuotaErrorFromProxySSEPacket,
  scanProxySSEBufferForQuotaError,
  flushProxySSEBufferForQuotaError,
  rememberQuotaError,
};
