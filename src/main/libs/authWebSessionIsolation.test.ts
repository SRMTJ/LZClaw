import { describe, expect, test, vi } from 'vitest';

import {
  clearEnterpriseAuthWebSessionCredentials,
  clearNativeAuthWebSessionCredentials,
} from './authWebSessionIsolation';

const createWebSession = () => ({
  clearStorageData: vi.fn(async () => undefined),
  cookies: {
    flushStore: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
});

describe('persistent authentication session isolation', () => {
  test('an enterprise transition removes only the displaced native refresh cookies', async () => {
    const webSession = createWebSession();

    await clearNativeAuthWebSessionCredentials(
      webSession,
      ['http://127.0.0.1:3100', 'http://127.0.0.1:3100'],
      'lzclaw_web_session',
    );

    expect(webSession.cookies.remove).toHaveBeenCalledOnce();
    expect(webSession.cookies.remove).toHaveBeenCalledWith(
      'http://127.0.0.1:3100/',
      'lzclaw_web_session',
    );
    expect(webSession.clearStorageData).not.toHaveBeenCalled();
    expect(webSession.cookies.flushStore).toHaveBeenCalledOnce();
  });

  test('a native transition clears only the displaced enterprise origins', async () => {
    const webSession = createWebSession();

    await clearEnterpriseAuthWebSessionCredentials(
      webSession,
      ['http://127.0.0.1:3107', 'http://127.0.0.1:3108'],
    );

    expect(webSession.clearStorageData).toHaveBeenCalledTimes(2);
    expect(webSession.clearStorageData).toHaveBeenNthCalledWith(1, {
      origin: 'http://127.0.0.1:3107',
    });
    expect(webSession.clearStorageData).toHaveBeenNthCalledWith(2, {
      origin: 'http://127.0.0.1:3108',
    });
    expect(webSession.cookies.remove).not.toHaveBeenCalled();
    expect(webSession.cookies.flushStore).toHaveBeenCalledOnce();
  });
});
