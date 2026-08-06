import { describe, expect, test } from 'vitest';

import { resolveLzClawUpdateUrl } from './endpoints';

describe('resolveLzClawUpdateUrl', () => {
  test('uses the local test-channel API for development builds', () => {
    expect(resolveLzClawUpdateUrl(true, false)).toBe(
      'http://127.0.0.1:8080/api/client-updates/lzclaw/test/update',
    );
    expect(resolveLzClawUpdateUrl(true, true)).toBe(
      'http://127.0.0.1:8080/api/client-updates/lzclaw/test/update-manual',
    );
  });

  test('uses the production domain and prod channel for packaged builds', () => {
    expect(resolveLzClawUpdateUrl(false, false)).toBe(
      'https://zhongtai.srmtj.com/api/client-updates/lzclaw/prod/update',
    );
    expect(resolveLzClawUpdateUrl(false, true)).toBe(
      'https://zhongtai.srmtj.com/api/client-updates/lzclaw/prod/update-manual',
    );
  });
});
