import { describe, expect, test } from 'vitest';

import { resolveLzClawModelCatalogUrl } from './endpoints';

describe('LZClaw model catalog endpoints', () => {
  test('uses the local platform API for an unpackaged development build', () => {
    expect(resolveLzClawModelCatalogUrl(true)).toBe(
      'http://127.0.0.1:8080/api/client-models/claw/models',
    );
  });

  test('uses the production platform API for a packaged build', () => {
    expect(resolveLzClawModelCatalogUrl(false)).toBe(
      'https://zhongtai.srmtj.com/api/client-models/claw/models',
    );
  });

  test('does not encode a test or production channel in the route', () => {
    expect(resolveLzClawModelCatalogUrl(true)).not.toMatch(/\/(test|prod)\//);
    expect(resolveLzClawModelCatalogUrl(false)).not.toMatch(/\/(test|prod)\//);
  });
});
