import crypto from 'crypto';
import { describe, expect, test, vi } from 'vitest';

import {
  appendCallbackReturnTo,
  appendLoginParams,
  startAuthLocalCallback,
} from './authLocalCallbackServer';

describe('appendLoginParams', () => {
  test('appends params inside hash route query for portal URLs', () => {
    const result = appendLoginParams(
      'https://lobsterai.youdao.com/portal#/login',
      {
        source: 'electron',
        redirect_uri: 'http://127.0.0.1:43210/auth/callback',
        state: 'test-state',
      },
    );

    expect(result).toBe(
      'https://lobsterai.youdao.com/portal#/login?source=electron&redirect_uri=http%3A%2F%2F127.0.0.1%3A43210%2Fauth%2Fcallback&state=test-state',
    );
  });

  test('preserves existing hash route params', () => {
    const result = appendLoginParams(
      'https://lobsterai.youdao.com/portal#/login?invitationCode=ABC123',
      { source: 'electron' },
    );

    expect(result).toBe(
      'https://lobsterai.youdao.com/portal#/login?invitationCode=ABC123&source=electron',
    );
  });

  test('appends params to normal URL query when there is no hash route', () => {
    const result = appendLoginParams('https://example.com/login?foo=bar', {
      source: 'electron',
    });

    expect(result).toBe('https://example.com/login?foo=bar&source=electron');
  });
});

describe('appendCallbackReturnTo', () => {
  test('adds portal return URL to the local callback redirect URI', () => {
    const result = appendCallbackReturnTo(
      'http://127.0.0.1:43210/auth/callback',
      'https://lobsterai.youdao.com/portal#/login?source=electron&electronLogin=success',
    );

    expect(result).toBe(
      'http://127.0.0.1:43210/auth/callback?return_to=https%3A%2F%2Flobsterai.youdao.com%2Fportal%23%2Flogin%3Fsource%3Delectron%26electronLogin%3Dsuccess',
    );
  });
});

describe('startAuthLocalCallback', () => {
  test('keeps the default callback alive for a fifteen-minute interactive login', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const callback = await startAuthLocalCallback({ onCode: () => {} });

    try {
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 15 * 60 * 1000);
    } finally {
      await callback.close();
      timeoutSpy.mockRestore();
    }
  });

  test('starts on 127.0.0.1 with a dynamic callback port', async () => {
    const callback = await startAuthLocalCallback({ onCode: () => {} });

    try {
      expect(callback.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
      expect(callback.state).toHaveLength(32);
      expect(callback.codeChallenge).toHaveLength(43);
      expect(callback).not.toHaveProperty('codeVerifier');
    } finally {
      await callback.close();
    }
  });

  test('notifies the owner when the interactive login times out', async () => {
    const onTimeout = vi.fn();
    const callback = await startAuthLocalCallback({
      onCode: () => {},
      onTimeout,
      timeoutMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(onTimeout).toHaveBeenCalledOnce();
      });
    } finally {
      await callback.close();
    }
  });

  test('notifies a reused callback owner when the shared login times out', async () => {
    const callback = await startAuthLocalCallback({
      onCode: () => {},
      timeoutMs: 1_000,
    });
    const onTimeout = vi.fn();
    await startAuthLocalCallback({
      onCode: () => {},
      onTimeout,
      timeoutMs: 10,
    });

    try {
      await vi.waitFor(() => {
        expect(onTimeout).toHaveBeenCalledOnce();
      });
    } finally {
      await callback.close();
    }
  });

  test('reuses the active callback so a repeated login does not invalidate the first page', async () => {
    const codes: string[] = [];
    const firstCallback = await startAuthLocalCallback({
      onCode: code => codes.push(code),
    });
    const secondCallback = await startAuthLocalCallback({ onCode: () => {} });

    expect(secondCallback.redirectUri).toBe(firstCallback.redirectUri);
    expect(secondCallback.state).toBe(firstCallback.state);
    expect(secondCallback.codeChallenge).toBe(firstCallback.codeChallenge);

    const response = await fetch(
      `${firstCallback.redirectUri}?code=first-page-code&state=${firstCallback.state}`,
    );

    expect(response.status).toBe(200);
    expect(codes).toEqual(['first-page-code']);
  });

  test('coalesces callback servers that start concurrently', async () => {
    const codes: string[] = [];
    const [firstCallback, secondCallback] = await Promise.all([
      startAuthLocalCallback({ onCode: code => codes.push(code) }),
      startAuthLocalCallback({ onCode: () => {} }),
    ]);

    try {
      expect(secondCallback.redirectUri).toBe(firstCallback.redirectUri);
      expect(secondCallback.state).toBe(firstCallback.state);
    } finally {
      await firstCallback.close();
    }
  });

  test('delivers code when callback path and state are valid', async () => {
    const delivered: Array<{ code: string; codeVerifier: string }> = [];
    const callback = await startAuthLocalCallback({
      onCode: (code, codeVerifier) => delivered.push({ code, codeVerifier }),
    });

    const response = await fetch(`${callback.redirectUri}?code=abc123&state=${callback.state}`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('登录成功');
    expect(delivered).toEqual([{
      code: 'abc123',
      codeVerifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    }]);
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(delivered[0].codeVerifier, 'ascii')
      .digest('base64url');
    expect(callback.codeChallenge).toBe(expectedChallenge);
  });

  test('returns a success page that redirects back to the portal when return_to is safe', async () => {
    const callback = await startAuthLocalCallback({ onCode: () => {} });
    const returnTo = encodeURIComponent(
      'https://lobsterai.youdao.com/portal#/login?source=electron&electronLogin=success',
    );

    const response = await fetch(
      `${callback.redirectUri}?return_to=${returnTo}&code=abc123&state=${callback.state}`,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('window.location.replace');
    expect(body).toContain('electronLogin=success');
  });

  test('allows loopback return_to URLs for local portal development', async () => {
    const callback = await startAuthLocalCallback({ onCode: () => {} });
    const returnTo = encodeURIComponent(
      'http://127.0.0.1:5180/login?source=electron&electronLogin=success',
    );

    const response = await fetch(
      `${callback.redirectUri}?return_to=${returnTo}&code=abc123&state=${callback.state}`,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('window.location.replace');
    expect(body).toContain('127.0.0.1:5180');
  });

  test('allows the LZClaw production login return_to URL', async () => {
    const callback = await startAuthLocalCallback({ onCode: () => {} });
    const returnTo = encodeURIComponent(
      'https://qiye.srmtj.com/login?source=electron&electronLogin=success',
    );

    const response = await fetch(
      `${callback.redirectUri}?return_to=${returnTo}&code=abc123&state=${callback.state}`,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('window.location.replace');
    expect(body).toContain('qiye.srmtj.com');
  });

  test('does not redirect to unsafe return_to URLs', async () => {
    const callback = await startAuthLocalCallback({ onCode: () => {} });
    const returnTo = encodeURIComponent(
      'https://example.com/login?source=electron&electronLogin=success',
    );

    const response = await fetch(
      `${callback.redirectUri}?return_to=${returnTo}&code=abc123&state=${callback.state}`,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain('window.location.replace');
    expect(body).not.toContain('example.com');
  });

  test('rejects callback when state does not match', async () => {
    const delivered: Array<{ code: string; codeVerifier: string }> = [];
    const callback = await startAuthLocalCallback({
      onCode: (code, codeVerifier) => delivered.push({ code, codeVerifier }),
    });

    const response = await fetch(`${callback.redirectUri}?code=abc123&state=wrong-state`);
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('登录失败');
    expect(delivered).toEqual([]);
  });

  test('returns 404 for non-callback paths', async () => {
    const callback = await startAuthLocalCallback({ onCode: () => {} });

    try {
      const response = await fetch(callback.redirectUri.replace('/auth/callback', '/other'));

      expect(response.status).toBe(404);
    } finally {
      await callback.close();
    }
  });
});
