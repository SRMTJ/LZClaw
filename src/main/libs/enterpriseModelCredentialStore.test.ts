import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`sealed:${value}`, 'utf8')),
    decryptString: vi.fn((value: Buffer) => value.toString('utf8').slice('sealed:'.length)),
  },
}));

import type { SqliteStore } from '../sqliteStore';
import {
  clearEnterpriseModelCredential,
  getEnterpriseModelCredential,
  saveEnterpriseModelCredential,
} from './enterpriseModelCredentialStore';

const credential = {
  provider: 'super_gateway' as const,
  tenantId: 'tenant-1',
  baseUrl: 'https://models.example.test/v1',
  apiKey: 'sk-1234567890abcdef',
};

const createStore = () => {
  const values = new Map<string, unknown>();
  return {
    values,
    store: {
      get: <T>(key: string) => values.get(key) as T | undefined,
      set: <T>(key: string, value: T) => values.set(key, value),
      delete: (key: string) => values.delete(key),
    } as unknown as SqliteStore,
  };
};

describe('enterprise model credential store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('persists only an operating-system-encrypted envelope', () => {
    const { store, values } = createStore();
    saveEnterpriseModelCredential(store, credential, false);

    expect(values.size).toBe(1);
    expect(JSON.stringify([...values.values()])).not.toContain(credential.apiKey);
    expect(getEnterpriseModelCredential(store, false)).toEqual(credential);
  });

  test('clears the in-memory and persisted credential together', () => {
    const { store } = createStore();
    saveEnterpriseModelCredential(store, credential, false);
    clearEnterpriseModelCredential(store);

    expect(getEnterpriseModelCredential(store, false)).toBeNull();
  });

  test('removes an invalid persisted envelope', () => {
    const { store, values } = createStore();
    clearEnterpriseModelCredential(store);
    values.set('auth_enterprise_model_credential', { version: 2, apiKey: credential.apiKey });

    expect(getEnterpriseModelCredential(store, false)).toBeNull();
    expect(values.size).toBe(0);
  });
});
