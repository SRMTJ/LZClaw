import { describe, expect, test } from 'vitest';

import {
  resolveAuthLoginPageUrl,
  shouldUseDevelopmentAuthEndpoints,
} from './constants';

describe('auth endpoint environment', () => {
  test('uses the online login and session endpoints for the current development configuration', () => {
    expect(resolveAuthLoginPageUrl(true)).toBe('https://qiye.srmtj.com/login');
    expect(shouldUseDevelopmentAuthEndpoints(true, false)).toBe(false);
  });

  test('never enables development auth endpoints in a packaged application', () => {
    expect(shouldUseDevelopmentAuthEndpoints(true, true)).toBe(false);
    expect(shouldUseDevelopmentAuthEndpoints(false, true)).toBe(false);
  });
});
