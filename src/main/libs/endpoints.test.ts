import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
  },
}));

import {
  getServerApiBaseUrl,
  refreshEndpointsTestMode,
} from './endpoints';

class MemoryStore {
  private values = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }
}

describe('getServerApiBaseUrl', () => {
  beforeEach(() => {
    delete process.env.LZCLAW_SERVER_API_BASE_URL;
    refreshEndpointsTestMode(new MemoryStore() as any);
  });

  test('uses enterprise auth apiBaseUrl before environment overrides', () => {
    process.env.LZCLAW_SERVER_API_BASE_URL = 'https://env-api.example.com/';
    const store = new MemoryStore();
    store.set('enterprise_config', {
      auth: {
        apiBaseUrl: 'https://enterprise-api.example.com/',
      },
    });

    refreshEndpointsTestMode(store as any);

    expect(getServerApiBaseUrl()).toBe('https://enterprise-api.example.com');
  });

  test('uses LZCLAW_SERVER_API_BASE_URL when no enterprise override exists', () => {
    process.env.LZCLAW_SERVER_API_BASE_URL = 'http://127.0.0.1:8080/';

    refreshEndpointsTestMode(new MemoryStore() as any);

    expect(getServerApiBaseUrl()).toBe('http://127.0.0.1:8080');
  });

  test('uses LZCLAW_SERVER_API_BASE_URL before app_config serverApiBaseUrl', () => {
    process.env.LZCLAW_SERVER_API_BASE_URL = 'http://127.0.0.1:8081/';
    const store = new MemoryStore();
    store.set('app_config', {
      app: {
        serverApiBaseUrl: 'https://stale-app-api.example.com/',
      },
    });

    refreshEndpointsTestMode(store as any);

    expect(getServerApiBaseUrl()).toBe('http://127.0.0.1:8081');
  });

  test('uses app_config auth apiBaseUrl when no enterprise or env override exists', () => {
    const store = new MemoryStore();
    store.set('app_config', {
      auth: {
        apiBaseUrl: 'https://app-auth-api.example.com/',
      },
      app: {
        serverApiBaseUrl: 'https://legacy-app-api.example.com/',
      },
    });

    refreshEndpointsTestMode(store as any);

    expect(getServerApiBaseUrl()).toBe('https://app-auth-api.example.com');
  });

  test('keeps existing test mode fallback when no explicit base URL exists', () => {
    const store = new MemoryStore();
    store.set('app_config', {
      app: {
        testMode: true,
      },
    });

    refreshEndpointsTestMode(store as any);

    expect(getServerApiBaseUrl()).toBe('https://lobsterai-server.inner.youdao.com');
  });
});
