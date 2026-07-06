import { describe, expect, test } from 'vitest';

import {
  isAllowedAuthLoginNavigation,
  isLoopbackAuthCallbackUrl,
  rememberAuthLoginRedirectOrigin,
} from './authLoginWindowPolicy';

describe('authLoginWindowPolicy', () => {
  test('allows only loopback auth callback URLs', () => {
    expect(isLoopbackAuthCallbackUrl('http://127.0.0.1:51234/auth/callback?code=abc')).toBe(true);
    expect(isLoopbackAuthCallbackUrl('http://localhost:51234/auth/callback?code=abc')).toBe(true);
    expect(isLoopbackAuthCallbackUrl('http://127.0.0.1/auth/callback?code=abc')).toBe(false);
    expect(isLoopbackAuthCallbackUrl('https://127.0.0.1:51234/auth/callback?code=abc')).toBe(false);
    expect(isLoopbackAuthCallbackUrl('http://evil.example/auth/callback?code=abc')).toBe(false);
  });

  test('allows initial trusted origin and local callback', () => {
    const allowedOrigins = new Set(['http://127.0.0.1:8081']);

    expect(isAllowedAuthLoginNavigation(
      'http://127.0.0.1:8081/api/auth/workstation/sso/start',
      allowedOrigins,
    )).toBe(true);
    expect(isAllowedAuthLoginNavigation(
      'http://127.0.0.1:58111/auth/callback?code=abc',
      allowedOrigins,
    )).toBe(true);
    expect(isAllowedAuthLoginNavigation(
      'http://casdoor.local/login/oauth/authorize',
      allowedOrigins,
    )).toBe(false);
  });

  test('remembers redirected auth origin only from an already trusted page', () => {
    const allowedOrigins = new Set(['http://127.0.0.1:8081']);

    expect(rememberAuthLoginRedirectOrigin(
      'http://127.0.0.1:8000/login/oauth/authorize',
      'http://127.0.0.1:8081/api/auth/workstation/sso/start',
      allowedOrigins,
    )).toBe(true);
    expect(allowedOrigins.has('http://127.0.0.1:8000')).toBe(true);

    expect(rememberAuthLoginRedirectOrigin(
      'http://evil.example/login',
      'http://unknown.example/start',
      allowedOrigins,
    )).toBe(false);
    expect(allowedOrigins.has('http://evil.example')).toBe(false);
  });
});
