import { describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  net: {
    fetch: vi.fn(),
  },
}));

import {
  parseModelIdFromOpenAIRequestBody,
  resolveOpenClawUpstreamRoute,
} from './openclawTokenProxy';

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
