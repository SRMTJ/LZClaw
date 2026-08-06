import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const handlers = new Map<string, Handler[]>();

  const webContents = {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return webContents;
    }),
    setWindowOpenHandler: vi.fn(),
    loadURL: vi.fn(async () => undefined),
  };
  const persistentController = {
    open: vi.fn(async () => ({
      status: 'opened' as 'opened' | 'superseded' | 'closed',
    })),
    close: vi.fn(async () => undefined),
    setBounds: vi.fn(() => true),
  };
  const localCallback = {
    codeChallenge: 'test-code-challenge',
    redirectUri: 'http://127.0.0.1:54321/auth/callback',
    state: 'test-state',
    close: vi.fn(async () => undefined),
  };
  const startAuthLocalCallback = vi.fn(async () => localCallback);

  return {
    localCallback,
    persistentController,
    startAuthLocalCallback,
    webContents,
    emit: (event: string, ...args: unknown[]) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
    resetHandlers: () => handlers.clear(),
  };
});

vi.mock('@fudanda/electron-persistent-view', () => ({
  PersistentViewOpenStatus: {
    Opened: 'opened',
    Superseded: 'superseded',
    Closed: 'closed',
  },
  PersistentViewController: class {
    constructor(options: {
      configureWebContents?: (context: {
        session: unknown;
        webContents: typeof mocks.webContents;
      }) => void;
    }) {
      options.configureWebContents?.({
        session: {},
        webContents: mocks.webContents,
      });
      return mocks.persistentController;
    }
  },
}));

vi.mock('./authLocalCallbackServer', () => ({
  appendCallbackReturnTo: (callbackUrl: string, returnTo: string) => {
    const parsed = new URL(callbackUrl);
    parsed.searchParams.set('return_to', returnTo);
    return parsed.toString();
  },
  appendLoginParams: (url: string, params: Record<string, string>) => {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      parsed.searchParams.set(key, value);
    }
    return parsed.toString();
  },
  startAuthLocalCallback: mocks.startAuthLocalCallback,
}));

import { AuthInAppLoginViewController } from './authInAppLoginView';

const createController = (onAuthenticatedNavigation = vi.fn(async () => true)) => {
  const parentWindow = {
    isDestroyed: () => false,
  };
  const onAuthCode = vi.fn();
  return {
    controller: new AuthInAppLoginViewController({
      getMainWindow: () => parentWindow as never,
      session: {} as never,
      isDev: true,
      onAuthCode,
      onAuthDeepLink: vi.fn(),
      isAllowedNavigation: url => new URL(url).origin === 'https://example.test',
      isAuthenticatedNavigation: url => {
        const parsed = new URL(url);
        return parsed.origin === 'https://example.test'
          && (parsed.pathname === '/users' || parsed.pathname === '/admin/');
      },
      onAuthenticatedNavigation,
    }),
    parentWindow,
    onAuthCode,
    onAuthenticatedNavigation,
  };
};

describe('AuthInAppLoginViewController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetHandlers();
    mocks.persistentController.open.mockResolvedValue({
      status: 'opened',
    });
  });

  test('completes only when the persistent view opens', async () => {
    const { controller, parentWindow } = createController();

    await expect(controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })).resolves.toBeUndefined();

    expect(mocks.persistentController.open).toHaveBeenCalledOnce();
    const openRequest = mocks.persistentController.open.mock.calls[0]?.[0];
    expect(openRequest).toMatchObject({
      parentWindow,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      focus: true,
    });
    const openedUrl = new URL(openRequest?.url ?? '');
    expect(openedUrl.searchParams.get('state')).toBe('test-state');
    expect(openedUrl.searchParams.get('code_challenge')).toBe('test-code-challenge');
    expect(openedUrl.searchParams.has('code_verifier')).toBe(false);
    expect(openedUrl.searchParams.get('redirect_uri')).toContain(
      'http://127.0.0.1:54321/auth/callback',
    );
  });

  test('keeps the verifier out of the login URL and forwards it with the callback code', async () => {
    const { controller, onAuthCode } = createController();
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    const callbackOptions = mocks.startAuthLocalCallback.mock.calls[0]?.[0] as {
      onCode: (code: string, codeVerifier: string) => void;
    };
    callbackOptions.onCode(`ent_${'d'.repeat(43)}`, 'v'.repeat(43));

    expect(onAuthCode).toHaveBeenCalledWith(`ent_${'d'.repeat(43)}`, 'v'.repeat(43));
    const openedUrl = mocks.persistentController.open.mock.calls[0]?.[0]?.url ?? '';
    expect(openedUrl).not.toContain('v'.repeat(43));
  });

  test('closes the callback when the persistent view does not open', async () => {
    mocks.persistentController.open.mockResolvedValueOnce({
      status: 'closed',
    });
    const { controller } = createController();

    await expect(controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })).rejects.toThrow('Embedded login was cancelled');

    expect(mocks.localCallback.close).toHaveBeenCalledOnce();
    expect(mocks.persistentController.close).toHaveBeenCalledTimes(2);
  });

  test('recovers an authenticated web session when login lands on the users page', async () => {
    const { controller, onAuthenticatedNavigation } = createController();
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    mocks.emit('did-navigate', {}, 'https://example.test/users');
    mocks.emit('did-navigate-in-page', {}, 'https://example.test/users', true);

    await vi.waitFor(() => {
      expect(onAuthenticatedNavigation).toHaveBeenCalledOnce();
    });
  });

  test('recovers an authenticated enterprise session when login lands on the admin portal', async () => {
    const { controller, onAuthenticatedNavigation } = createController();
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    mocks.emit('did-navigate', {}, 'https://example.test/admin/');

    await vi.waitFor(() => {
      expect(onAuthenticatedNavigation).toHaveBeenCalledWith('https://example.test/admin/');
    });
  });

  test('restores the desktop login URL when web-session recovery is rejected', async () => {
    const { controller } = createController(vi.fn(async () => false));
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    mocks.emit('did-navigate', {}, 'https://example.test/users');

    await vi.waitFor(() => {
      expect(mocks.webContents.loadURL).toHaveBeenCalledOnce();
    });
    const restoredUrl = new URL(mocks.webContents.loadURL.mock.calls[0]?.[0] ?? '');
    expect(restoredUrl.origin).toBe('https://example.test');
    expect(restoredUrl.pathname).toBe('/login');
    expect(restoredUrl.searchParams.get('state')).toBe('test-state');
    expect(restoredUrl.searchParams.get('code_challenge')).toBe('test-code-challenge');
    expect(restoredUrl.searchParams.has('code_verifier')).toBe(false);
  });

  test('ignores authenticated-looking routes from another origin', async () => {
    const { controller, onAuthenticatedNavigation } = createController();
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    mocks.emit('did-navigate', {}, 'https://attacker.test/users');
    await Promise.resolve();

    expect(onAuthenticatedNavigation).not.toHaveBeenCalled();
  });

  test('rejects an untrusted initial URL before starting the callback server', async () => {
    const { controller } = createController();

    await expect(controller.open({
      loginUrl: 'https://attacker.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })).rejects.toThrow('Embedded login URL is not trusted');

    expect(mocks.startAuthLocalCallback).not.toHaveBeenCalled();
    expect(mocks.persistentController.open).not.toHaveBeenCalled();
  });

  test('blocks untrusted redirects and popups inside the persistent auth session', async () => {
    const { controller } = createController();
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    const preventDefault = vi.fn();
    mocks.emit('will-navigate', { preventDefault }, 'https://attacker.test/login');
    const popupHandler = mocks.webContents.setWindowOpenHandler.mock.calls.at(-1)?.[0];
    const popupResult = popupHandler?.({ url: 'https://attacker.test/login' });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(popupResult).toEqual({ action: 'deny' });
    expect(mocks.webContents.loadURL).not.toHaveBeenCalledWith('https://attacker.test/login');
  });

  test('allows only the exact active loopback callback target', async () => {
    const { controller } = createController();
    await controller.open({
      loginUrl: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    });

    const allowedEvent = { preventDefault: vi.fn() };
    mocks.emit(
      'will-navigate',
      allowedEvent,
      'http://127.0.0.1:54321/auth/callback?code=ent_code&state=test-state',
    );
    expect(allowedEvent.preventDefault).not.toHaveBeenCalled();

    const wrongPortEvent = { preventDefault: vi.fn() };
    mocks.emit(
      'will-navigate',
      wrongPortEvent,
      'http://127.0.0.1:54322/auth/callback?code=ent_code&state=test-state',
    );
    expect(wrongPortEvent.preventDefault).toHaveBeenCalledOnce();

    const wrongPathEvent = { preventDefault: vi.fn() };
    mocks.emit(
      'will-redirect',
      wrongPathEvent,
      'http://127.0.0.1:54321/other?code=ent_code&state=test-state',
    );
    expect(wrongPathEvent.preventDefault).toHaveBeenCalledOnce();
  });
});
