import { describe, expect, test } from 'vitest';

import { isEnterpriseModelCredential } from './constants';

describe('enterprise model credential validation', () => {
  const credential = {
    provider: 'super_gateway',
    tenantId: 'tenant-1',
    baseUrl: 'https://models.example.test/v1',
    apiKey: 'sk-1234567890abcdef',
  };

  test('accepts an HTTPS tenant-bound credential', () => {
    expect(isEnterpriseModelCredential(credential, false)).toBe(true);
  });

  test('rejects remote HTTP and credentials embedded in the URL', () => {
    expect(isEnterpriseModelCredential({
      ...credential,
      baseUrl: 'http://models.example.test/v1',
    }, true)).toBe(false);
    expect(isEnterpriseModelCredential({
      ...credential,
      baseUrl: 'https://user:password@models.example.test/v1',
    }, false)).toBe(false);
  });

  test('allows loopback HTTP only in development', () => {
    const local = { ...credential, baseUrl: 'http://127.0.0.1:8080/v1' };
    expect(isEnterpriseModelCredential(local, true)).toBe(true);
    expect(isEnterpriseModelCredential(local, false)).toBe(false);
  });
});
