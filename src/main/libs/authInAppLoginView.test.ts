import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;

  const webContents = {
    on: vi.fn((_event: string, _handler: Handler) => webContents),
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
    redirectUri: 'http://127.0.0.1:54321/callback',
    state: 'test-state',
    close: vi.fn(async () => undefined),
  };
  const startAuthLocalCallback = vi.fn(async () => localCallback);

  return {
    localCallback,
    persistentController,
    startAuthLocalCallback,
    webContents,
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
  appendCallbackReturnTo: (callbackUrl: string) => callbackUrl,
  appendLoginParams: (url: string) => url,
  startAuthLocalCallback: mocks.startAuthLocalCallback,
}));

import { AuthInAppLoginViewController } from './authInAppLoginView';

const createController = () => {
  const parentWindow = {
    isDestroyed: () => false,
  };
  return {
    controller: new AuthInAppLoginViewController({
      getMainWindow: () => parentWindow as never,
      session: {} as never,
      isDev: true,
      onAuthCode: vi.fn(),
      onAuthDeepLink: vi.fn(),
    }),
    parentWindow,
  };
};

describe('AuthInAppLoginViewController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(mocks.persistentController.open).toHaveBeenCalledWith({
      parentWindow,
      url: 'https://example.test/login',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      focus: true,
    });
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
});
