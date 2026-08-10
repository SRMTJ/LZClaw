import { describe, expect, test, vi } from 'vitest';

import {
  ClientModelCatalogStatus,
  fetchClientModelCatalog,
  parseClientModelCatalogResponse,
} from './clientModelCatalog';

const validResponse = () => ({
  code: 0,
  data: {
    appCode: 'claw',
    status: 'success',
    source: 'super_gateway',
    syncedAt: '2026-08-10T08:00:00Z',
    models: [{
      modelId: 'kimi-k2',
      modelName: 'Kimi K2',
      provider: 'super_gateway',
      apiFormat: 'openai',
      platforms: ['openai'],
      accessible: true,
    }],
  },
});

describe('client model catalog', () => {
  test('parses the sanitized public contract', () => {
    expect(parseClientModelCatalogResponse(validResponse())).toEqual({
      status: ClientModelCatalogStatus.Success,
      syncedAt: '2026-08-10T08:00:00Z',
      models: [{
        modelId: 'kimi-k2',
        modelName: 'Kimi K2',
        provider: 'super_gateway',
        apiFormat: 'openai',
        platforms: ['openai'],
        accessible: true,
      }],
    });
  });

  test('accepts an empty disabled catalog', () => {
    const response = validResponse();
    response.data.status = 'disabled';
    response.data.syncedAt = null as unknown as string;
    response.data.models = [];

    expect(parseClientModelCatalogResponse(response)).toEqual({
      status: ClientModelCatalogStatus.Disabled,
      syncedAt: undefined,
      models: [],
    });
  });

  test.each([
    ['wrong application', (response: ReturnType<typeof validResponse>) => {
      response.data.appCode = 'other';
    }],
    ['unexpected source', (response: ReturnType<typeof validResponse>) => {
      response.data.source = 'internal_channels';
    }],
    ['unsupported API format', (response: ReturnType<typeof validResponse>) => {
      response.data.models[0].apiFormat = 'unknown';
    }],
    ['duplicate model ID', (response: ReturnType<typeof validResponse>) => {
      response.data.models.push({ ...response.data.models[0], modelId: 'KIMI-K2' });
    }],
  ])('rejects %s', (_name, mutate) => {
    const response = validResponse();
    mutate(response);
    expect(() => parseClientModelCatalogResponse(response)).toThrow(
      'Client model catalog response is invalid.',
    );
  });

  test('fetches without an authorization header', async () => {
    const fetchPublic = vi.fn(async () => new Response(
      JSON.stringify(validResponse()),
      { status: 200 },
    ));

    await fetchClientModelCatalog(
      'https://zhongtai.srmtj.com/api/client-models/claw/models',
      fetchPublic,
    );

    expect(fetchPublic).toHaveBeenCalledWith(
      'https://zhongtai.srmtj.com/api/client-models/claw/models',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
    const [, request] = fetchPublic.mock.calls[0];
    expect(request?.headers).not.toHaveProperty('Authorization');
  });

  test('does not parse an error response body', async () => {
    const responseJson = vi.fn();
    const fetchPublic = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: responseJson,
    } as unknown as Response));

    await expect(fetchClientModelCatalog('https://example.test/models', fetchPublic))
      .rejects.toThrow('Client model catalog request failed with HTTP 503.');
    expect(responseJson).not.toHaveBeenCalled();
  });
});
