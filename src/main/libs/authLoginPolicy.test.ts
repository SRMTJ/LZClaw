import { describe, expect, test } from 'vitest';

import { isTrustedAuthLoginNavigation } from './authLoginPolicy';

describe('isTrustedAuthLoginNavigation', () => {
  test('allows only the fixed development login and handoff origins', () => {
    expect(isTrustedAuthLoginNavigation('http://127.0.0.1:3103/login', true)).toBe(true);
    expect(isTrustedAuthLoginNavigation('http://127.0.0.1:3107/login-result', true)).toBe(true);
    expect(isTrustedAuthLoginNavigation('http://127.0.0.1:3108/applications', true)).toBe(true);
    expect(isTrustedAuthLoginNavigation('https://qiye.srmtj.com/login', true)).toBe(false);
  });

  test('allows only the fixed production origin', () => {
    expect(isTrustedAuthLoginNavigation('https://qiye.srmtj.com/login', false)).toBe(true);
    expect(isTrustedAuthLoginNavigation('https://qiye.srmtj.com/admin/', false)).toBe(true);
    expect(isTrustedAuthLoginNavigation('http://127.0.0.1:3103/login', false)).toBe(false);
  });

  test('rejects arbitrary origins, URL credentials, and unsupported protocols', () => {
    expect(isTrustedAuthLoginNavigation('https://attacker.test/login', false)).toBe(false);
    expect(isTrustedAuthLoginNavigation('https://user:secret@qiye.srmtj.com/login', false)).toBe(false);
    expect(isTrustedAuthLoginNavigation('file:///C:/login.html', false)).toBe(false);
  });
});
