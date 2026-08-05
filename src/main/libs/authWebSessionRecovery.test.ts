import { describe, expect, test, vi } from 'vitest';

import {
  AuthWebSessionRecoveryStatus,
  isAuthenticatedPortalNavigation,
  recoverAuthTokensFromWebSession,
} from './authWebSessionRecovery';

const PORTAL_ORIGIN = 'http://localhost:3100';

const createOptions = (overrides: Partial<Parameters<typeof recoverAuthTokensFromWebSession>[0]> = {}) => ({
  navigationUrl: `${PORTAL_ORIGIN}/users`,
  portalOrigin: PORTAL_ORIGIN,
  cookieName: 'lzclaw_web_session',
  getCookies: vi.fn(async () => [{ value: 'refresh-old' }]),
  refreshUrl: `${PORTAL_ORIGIN}/api/auth/refresh`,
  buildRefreshRequestBody: (refreshToken: string) => JSON.stringify({ refreshToken }),
  fetch: vi.fn(async () => new Response(JSON.stringify({
    code: 0,
    data: {
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
    },
  }), { status: 200 })),
  ...overrides,
});

describe('isAuthenticatedPortalNavigation', () => {
  test('accepts only the portal users route', () => {
    expect(isAuthenticatedPortalNavigation(`${PORTAL_ORIGIN}/users`, PORTAL_ORIGIN)).toBe(true);
    expect(isAuthenticatedPortalNavigation(`${PORTAL_ORIGIN}/users/42`, PORTAL_ORIGIN)).toBe(true);
    expect(isAuthenticatedPortalNavigation(`${PORTAL_ORIGIN}/login`, PORTAL_ORIGIN)).toBe(false);
    expect(isAuthenticatedPortalNavigation('https://example.com/users', PORTAL_ORIGIN)).toBe(false);
  });
});

describe('recoverAuthTokensFromWebSession', () => {
  test('ignores unrelated navigation without reading cookies', async () => {
    const options = createOptions({ navigationUrl: `${PORTAL_ORIGIN}/login` });

    await expect(recoverAuthTokensFromWebSession(options)).resolves.toEqual({
      status: AuthWebSessionRecoveryStatus.Ignored,
    });
    expect(options.getCookies).not.toHaveBeenCalled();
    expect(options.fetch).not.toHaveBeenCalled();
  });

  test('reports a missing web session cookie', async () => {
    const options = createOptions({ getCookies: vi.fn(async () => []) });

    await expect(recoverAuthTokensFromWebSession(options)).resolves.toEqual({
      status: AuthWebSessionRecoveryStatus.MissingCookie,
    });
    expect(options.fetch).not.toHaveBeenCalled();
  });

  test('refreshes native tokens from the HttpOnly web session cookie', async () => {
    const options = createOptions();

    await expect(recoverAuthTokensFromWebSession(options)).resolves.toEqual({
      status: AuthWebSessionRecoveryStatus.Recovered,
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
    });
    expect(options.getCookies).toHaveBeenCalledWith({
      url: `${PORTAL_ORIGIN}/`,
      name: 'lzclaw_web_session',
    });
    expect(options.fetch).toHaveBeenCalledWith(
      `${PORTAL_ORIGIN}/api/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'refresh-old' }),
      },
    );
  });

  test('keeps the cookie token when refresh does not rotate it', async () => {
    const options = createOptions({
      fetch: vi.fn(async () => new Response(JSON.stringify({
        code: 0,
        data: { accessToken: 'access-new' },
      }), { status: 200 })),
    });

    await expect(recoverAuthTokensFromWebSession(options)).resolves.toMatchObject({
      status: AuthWebSessionRecoveryStatus.Recovered,
      refreshToken: 'refresh-old',
    });
  });

  test('does not persist a rejected refresh response', async () => {
    const options = createOptions({
      fetch: vi.fn(async () => new Response(JSON.stringify({ code: 1 }), { status: 401 })),
    });

    await expect(recoverAuthTokensFromWebSession(options)).resolves.toEqual({
      status: AuthWebSessionRecoveryStatus.Rejected,
      httpStatus: 401,
      errorCode: 1,
    });
  });
});
