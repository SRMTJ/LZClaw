import { beforeEach, describe, expect, test, vi } from 'vitest';

const { updateServerModelMetadata } = vi.hoisted(() => ({
  updateServerModelMetadata: vi.fn(),
}));

vi.mock('./claudeSettings', () => ({
  updateServerModelMetadata,
}));

import {
  buildServerModelCapabilityHeaders,
  runStartupCacheWarmup,
} from './startupCacheWarmup';

beforeEach(() => {
  updateServerModelMetadata.mockReset();
});

describe('startup server model warmup', () => {
  test('sends the fixed K3 capability and client version', () => {
    expect(buildServerModelCapabilityHeaders('2026.7.23')).toEqual({
      Accept: 'application/json',
      'X-LobsterAI-Client-Capabilities': 'kimi-k3-agentic-v1,thinking-level-control-v1',
      'X-LobsterAI-Client-Version': '2026.7.23',
    });
  });

  test('loads the public catalog without sending the native auth request through it', async () => {
    const serverModels = [{
      modelId: 'kimi-k2',
      modelName: 'Kimi K2',
      provider: 'super_gateway',
      apiFormat: 'openai',
      platforms: ['openai'],
      accessible: true,
    }];
    const fetchWithAuth = vi.fn(async () => new Response(JSON.stringify({
      code: 0,
      data: {
        subscriptionStatus: 'free',
      },
    }), { status: 200 }));
    const fetchPublic = vi.fn(async () => new Response(JSON.stringify({
      code: 0,
      data: {
        appCode: 'claw',
        status: 'success',
        source: 'super_gateway',
        syncedAt: '2026-08-10T08:00:00Z',
        models: serverModels,
      },
    }), {
        status: 200,
      }));

    await runStartupCacheWarmup({
      serverBaseUrl: 'https://lobster.test',
      modelCatalogUrl: 'https://platform.test/api/client-models/claw/models',
      fetchWithAuth,
      fetchPublic,
      cachedSubscriptionStatus: 'free',
      clientVersion: '2026.7.23',
      t: key => key,
    });

    expect(updateServerModelMetadata).toHaveBeenCalledWith(serverModels);
    expect(fetchPublic).toHaveBeenCalledWith(
      'https://platform.test/api/client-models/claw/models',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'X-LobsterAI-Client-Capabilities': 'kimi-k3-agentic-v1,thinking-level-control-v1',
          'X-LobsterAI-Client-Version': '2026.7.23',
        },
      }),
    );
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    expect(fetchWithAuth).toHaveBeenCalledWith(
      'https://lobster.test/api/user/quota',
      expect.any(Object),
    );
  });
});
