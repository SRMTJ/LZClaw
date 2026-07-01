import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  net: {
    fetch: vi.fn(),
  },
}));

import {
  __openClawTokenProxyTestUtils,
  consumeRecentOpenClawTokenProxyQuotaError,
  parseModelIdFromOpenAIRequestBody,
  resolveOpenClawUpstreamRoute,
} from './openclawTokenProxy';

const testUtils = __openClawTokenProxyTestUtils;

beforeEach(() => {
  consumeRecentOpenClawTokenProxyQuotaError();
});

describe('openclawTokenProxy route decision', () => {
  test('routes to direct upstream when model has apiBaseUrl and apiKey', () => {
    const route = resolveOpenClawUpstreamRoute({
      requestUrl: '/v1/chat/completions',
      body: Buffer.from(JSON.stringify({ model: 'deepseek-v3.2' })),
      fallbackAccessToken: 'fallback-access-token',
      serverBaseUrl: 'http://127.0.0.1:5000',
      models: [
        {
          modelId: 'deepseek-v3.2',
          apiBaseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'sk-direct-deepseek',
        },
      ],
    });

    expect(route.source).toBe('direct');
    expect(route.modelId).toBe('deepseek-v3.2');
    expect(route.url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(route.authToken).toBe('sk-direct-deepseek');
  });

  test('falls back to server proxy when direct model config is incomplete', () => {
    const route = resolveOpenClawUpstreamRoute({
      requestUrl: '/v1/chat/completions',
      body: Buffer.from(JSON.stringify({ model: 'deepseek-v3.2' })),
      fallbackAccessToken: 'fallback-access-token',
      serverBaseUrl: 'http://127.0.0.1:5000',
      models: [
        {
          modelId: 'deepseek-v3.2',
          apiBaseUrl: 'https://api.deepseek.com/v1',
          apiKey: '',
        },
      ],
    });

    expect(route.source).toBe('fallback');
    expect(route.modelId).toBe('deepseek-v3.2');
    expect(route.url).toBe('http://127.0.0.1:5000/api/proxy/v1/chat/completions');
    expect(route.authToken).toBe('fallback-access-token');
  });

  test('falls back to server proxy when model is unknown', () => {
    const route = resolveOpenClawUpstreamRoute({
      requestUrl: '/v1/chat/completions',
      body: Buffer.from(JSON.stringify({ model: 'unknown-model' })),
      fallbackAccessToken: 'fallback-access-token',
      serverBaseUrl: 'http://127.0.0.1:5000',
      models: [
        {
          modelId: 'deepseek-v3.2',
          apiBaseUrl: 'https://api.deepseek.com/chat/completions',
          apiKey: 'sk-direct-deepseek',
        },
      ],
    });

    expect(route.source).toBe('fallback');
    expect(route.modelId).toBe('unknown-model');
    expect(route.url).toBe('http://127.0.0.1:5000/api/proxy/v1/chat/completions');
    expect(route.authToken).toBe('fallback-access-token');
  });
});

describe('parseModelIdFromOpenAIRequestBody', () => {
  test('returns model id for valid request body', () => {
    const modelId = parseModelIdFromOpenAIRequestBody(
      Buffer.from(JSON.stringify({ model: 'deepseek-v3.2' })),
    );
    expect(modelId).toBe('deepseek-v3.2');
  });

  test('returns null for invalid body', () => {
    const modelId = parseModelIdFromOpenAIRequestBody(Buffer.from('{not-json'));
    expect(modelId).toBeNull();
  });
});

describe('openclawTokenProxy quota error detection', () => {
  test('extracts LobsterAI monthly quota error from proxy SSE packet', () => {
    const packet = [
      'event: error',
      'data: {"type":"error","error":{"type":"proxy_error","message":"本月积分已用完","code":40202}}',
    ].join('\n');

    expect(testUtils.extractQuotaErrorFromProxySSEPacket(packet)).toEqual({
      message: '本月积分已用完',
      code: 40202,
    });
  });

  test('ignores generic HTTP 402 without LobsterAI quota code or message', () => {
    const packet = [
      'event: error',
      'data: {"error":{"message":"Request failed with status 402"}}',
    ].join('\n');

    expect(testUtils.extractQuotaErrorFromProxySSEPacket(packet)).toBeNull();
  });

  test('scans split SSE chunks and stores a recent quota error', () => {
    const now = 1_000;
    let buffer = testUtils.scanProxySSEBufferForQuotaError(
      'event: error\ndata: {"type":"error","error":{"message":"本月',
      now,
    );

    buffer = testUtils.scanProxySSEBufferForQuotaError(
      `${buffer}积分已用完","code":40202}}\n\n`,
      now + 1,
    );

    expect(buffer).toBe('');
    expect(consumeRecentOpenClawTokenProxyQuotaError(now + 2)).toEqual({
      message: '本月积分已用完',
      code: 40202,
      capturedAt: now + 1,
    });
  });

  test('expires stale remembered quota errors', () => {
    testUtils.rememberQuotaError({ message: '本月积分已用完', code: 40202 }, 1_000);

    expect(consumeRecentOpenClawTokenProxyQuotaError(32_000)).toBeNull();
  });
});
