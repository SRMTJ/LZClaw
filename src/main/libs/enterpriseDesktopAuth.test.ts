import { describe, expect, test, vi } from 'vitest';

import {
  EnterpriseDesktopExchangeStatus,
  EnterpriseDesktopVerifierStore,
  exchangeEnterpriseDesktopAuthorization,
  resolveEnterpriseDesktopExchangeUrl,
  shouldUseLegacyDesktopAuthorizationExchange,
} from './enterpriseDesktopAuth';

describe('enterprise desktop authorization exchange', () => {
  const codeVerifier = 'v'.repeat(43);

  test('uses the configured unified login origin', () => {
    expect(resolveEnterpriseDesktopExchangeUrl(true)).toBe(
      'https://qiye.srmtj.com/auth/workstation-desktop-exchange',
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
      codeVerifier,
      fetch,
      isDevelopment: true,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Exchanged,
      entryType: 'employee',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://qiye.srmtj.com/auth/workstation-desktop-exchange',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authCode: `ent_${'d'.repeat(43)}`,
          codeVerifier,
        }),
      },
    );
  });

  test('accepts only a valid tenant-bound enterprise model credential', async () => {
    const valid = {
      provider: 'super_gateway',
      tenantId: 'tenant-1',
      baseUrl: 'https://models.example.test/v1',
      apiKey: 'sk-1234567890abcdef',
    };
    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      codeVerifier,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        code: 0,
        data: { entryType: 'admin', modelCredential: valid },
      }), { status: 200 })),
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Exchanged,
      entryType: 'admin',
      modelCredential: valid,
    });

    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'e'.repeat(43)}`,
      codeVerifier,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        code: 0,
        data: {
          entryType: 'admin',
          modelCredential: { ...valid, baseUrl: 'http://models.example.test/v1' },
        },
      }), { status: 200 })),
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Exchanged,
      entryType: 'admin',
    });
  });

  test('does not fall through on a rejected, missing, or malformed enterprise exchange', async () => {
    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      codeVerifier,
      fetch: vi.fn(async () => new Response(null, { status: 409 })),
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 409,
    });
    const missingRouteResult = await exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      codeVerifier,
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
      codeVerifier,
      fetch: vi.fn(),
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 400,
    });
  });

  test('rejects missing or invalid verifiers without making a request', async () => {
    const fetch = vi.fn();

    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      fetch,
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 400,
    });
    await expect(exchangeEnterpriseDesktopAuthorization({
      authCode: `ent_${'d'.repeat(43)}`,
      codeVerifier: 'too-short',
      fetch,
      isDevelopment: false,
    })).resolves.toEqual({
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 400,
    });
    expect(fetch).not.toHaveBeenCalled();
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

describe('EnterpriseDesktopVerifierStore', () => {
  const authCode = `ent_${'d'.repeat(43)}`;
  const codeVerifier = 'v'.repeat(43);

  test('binds a verifier to one enterprise code and consumes it once', () => {
    const store = new EnterpriseDesktopVerifierStore();

    expect(store.bind(authCode, codeVerifier)).toBe(true);
    expect(store.consume(authCode)).toBe(codeVerifier);
    expect(store.consume(authCode)).toBeNull();
  });

  test('does not expose a verifier to a different authorization code', () => {
    const store = new EnterpriseDesktopVerifierStore();
    store.bind(authCode, codeVerifier);

    expect(store.consume(`ent_${'e'.repeat(43)}`)).toBeNull();
    expect(store.consume(authCode)).toBe(codeVerifier);
  });

  test('expires verifier bindings and rejects invalid inputs', () => {
    let now = 1_000;
    const store = new EnterpriseDesktopVerifierStore({
      now: () => now,
      ttlMs: 50,
    });

    expect(store.bind('legacy-code', codeVerifier)).toBe(false);
    expect(store.bind(authCode, 'too-short')).toBe(false);
    expect(store.bind(authCode, codeVerifier)).toBe(true);
    now += 50;
    expect(store.consume(authCode)).toBeNull();
  });
});
