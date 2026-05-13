import http from 'http';
import { net } from 'electron';

import type { ServerModelMetadata } from './claudeSettings';
import { buildOpenAIChatCompletionsURL } from './coworkFormatTransform';

const PROXY_BIND_HOST = '127.0.0.1';

let proxyServer: http.Server | null = null;
let proxyPort: number | null = null;

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
    console.log('[OpenClawTokenProxy] stopped');
  }
}

export function getOpenClawTokenProxyPort(): number | null {
  return proxyPort;
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

  if (result.isStream && 'pipe' in result.body && typeof (result.body as NodeJS.ReadableStream).pipe === 'function') {
    (result.body as NodeJS.ReadableStream).pipe(res);
  } else if (Buffer.isBuffer(result.body)) {
    res.end(result.body);
  } else {
    // Web ReadableStream from net.fetch — need to consume manually
    const webStream = result.body as unknown as ReadableStream<Uint8Array>;
    const reader = webStream.getReader();
    const pump = (): void => {
      reader.read().then(({ done, value }) => {
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        pump();
      }).catch((err) => {
        console.error('[OpenClawTokenProxy] stream read error:', err);
        res.end();
      });
    };
    pump();
  }
}
