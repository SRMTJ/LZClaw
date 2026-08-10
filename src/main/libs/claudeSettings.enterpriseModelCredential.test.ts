import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  net: { fetch: vi.fn() },
}));

import { ProviderName } from '../../shared/providers';
import type { SqliteStore } from '../sqliteStore';
import {
  resolveRawApiConfig,
  setAuthTokensGetter,
  setEnterpriseModelCredentialGetter,
  setServerBaseUrlGetter,
  setStoreGetter,
  updateServerModelMetadata,
} from './claudeSettings';

describe('enterprise model credential provider resolution', () => {
  afterEach(() => {
    setStoreGetter(() => null);
    setAuthTokensGetter(() => null);
    setEnterpriseModelCredentialGetter(() => null);
    setServerBaseUrlGetter(() => '');
    updateServerModelMetadata([]);
  });

  test('resolves a public catalog model without legacy auth tokens', () => {
    const store = {
      get: (key: string) => key === 'app_config'
        ? {
            model: {
              defaultModel: 'gpt-5.4',
              defaultModelProvider: ProviderName.LobsteraiServer,
            },
            providers: {},
          }
        : undefined,
    } as unknown as SqliteStore;
    setStoreGetter(() => store);
    setAuthTokensGetter(() => null);
    setServerBaseUrlGetter(() => 'https://legacy.example.test');
    setEnterpriseModelCredentialGetter(() => ({
      provider: 'super_gateway',
      tenantId: 'tenant-1',
      baseUrl: 'https://models.example.test/v1',
      apiKey: 'sk-1234567890abcdef',
    }));
    updateServerModelMetadata([{
      modelId: 'gpt-5.4',
      modelName: 'GPT 5.4',
      provider: 'super_gateway',
      apiFormat: 'openai',
    }]);

    const resolution = resolveRawApiConfig();

    expect(resolution.error).toBeUndefined();
    expect(resolution.providerMetadata?.providerName).toBe(ProviderName.LobsteraiServer);
    expect(resolution.config).toMatchObject({
      model: 'gpt-5.4',
      baseURL: 'https://models.example.test/v1',
      apiKey: 'sk-1234567890abcdef',
      apiType: 'openai',
    });
  });
});
