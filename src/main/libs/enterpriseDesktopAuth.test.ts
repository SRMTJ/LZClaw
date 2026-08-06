import { describe, expect, test, vi } from 'vitest';

import {
  EnterpriseDesktopExchangeStatus,
  exchangeEnterpriseDesktopAuthorization,
  resolveEnterpriseDesktopExchangeUrl,
  shouldUseLegacyDesktopAuthorizationExchange,
} from './enterpriseDesktopAuth';

describe('enterprise desktop authorization exchange', () => {
  test('uses the environment-specific unified login origin', () => {
    expect(resolveEnterpriseDesktopExchangeUrl(true)).toBe(
      'http://127.0.0.1:3103/auth/workstation-desktop-exchange',
    );
    expect(resolveEnterpriseDesktopExchangeUrl(false)).toBe(
      'https://qiye.srmtj.com/auth/workstation-desktop-exchange',
    );
  });

  test('exchanges an opaque code inside the persistent web Session', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      code: 0,
      data: { entryType: 'employee' },
    }), { status: 200 }));

    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      fetch,
      isDevelopment: true,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Exchanged,
      entryType: 'employee',
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3103/auth/workstation-desktop-exchange',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authCode: `ent_${'d'.repeat(43)}` }),
      },
    );
  });

  test('does not fall through on a rejected, missing, or malformed enterprise exchange', async () => {
    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      fetch: vi.fn(async () => new Response(null, { status: 409 })),
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 409,
    });
    const missingRouteResult = await exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
      isDevelopment: false,
    });
    expect(missingRouteResult).toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 404,
    });
    expect(shouldUseLegacyDesktopAuthorizationExchange(
      `ent_${'d'.repeat(43)}`,
      missingRouteResult,
    )).toBe(false);
    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: 'ent_short',
      fetch: vi.fn(),
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 400,
    });
  });

  test('leaves non-enterprise authorization codes to the legacy exchange', async () => {
    const fetch = vi.fn();
    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: 'd'.repeat(43),
      fetch,
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Unsupported,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(shouldUseLegacyDesktopAuthorizationExchange(
      'd'.repeat(43),
      { status: EnterpriseDesktopExchangeStatus.Unsupported },
    )).toBe(true);
  });
});
