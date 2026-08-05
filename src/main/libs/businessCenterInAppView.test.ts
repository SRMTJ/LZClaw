import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type Handler = (...args: any[]) => void;

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
    webContents: null as object | null,
    open: vi.fn(async () => {
      persistentController.webContents = {};
      return {
        status: 'opened' as 'opened' | 'superseded' | 'closed',
      };
    }),
    setBounds: vi.fn(() => true),
    show: vi.fn(() => true),
    hide: vi.fn(() => true),
    reload: vi.fn(() => true),
    close: vi.fn(async () => {
      persistentController.webContents = null;
    }),
    clearStorageData: vi.fn(async () => undefined),
  };
  const openExternal = vi.fn(async () => undefined);

  return {
    handlers,
    webContents,
    persistentController,
    openExternal,
    emit(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) handler(...args);
    },
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

vi.mock('electron', () => ({
  shell: {
    openExternal: mocks.openExternal,
  },
}));

import { BusinessCenterInAppViewController } from './businessCenterInAppView';

const createController = (isDev = true) => {
  const statuses: Array<{ status: string; error?: string }> = [];
  const onSessionInvalidated = vi.fn();
  const parentWindow = {
    isDestroyed: () => false,
  };
  const controller = new BusinessCenterInAppViewController({
    getMainWindow: () => parentWindow as never,
    session: {} as never,
    isDev,
    onStatus: update => statuses.push(update),
    onSessionInvalidated,
  });
  return {
    controller,
    statuses,
    onSessionInvalidated,
    parentWindow,
  };
};

describe('BusinessCenterInAppViewController', () => {
  beforeEach(() => {
    mocks.handlers.clear();
    vi.clearAllMocks();
    mocks.persistentController.webContents = null;
  });

  test('opens the fixed development business center in the persistent controller', async () => {
    const { controller, parentWindow, statuses } = createController();
    const bounds = { x: 10, y: 20, width: 800, height: 600 };

    await expect(controller.open(bounds)).resolves.toBe(true);

    expect(mocks.persistentController.open).toHaveBeenCalledWith({
      parentWindow,
      url: 'http://127.0.0.1:3107',
      bounds,
      visible: true,
      focus: false,
    });
    expect(statuses).toContainEqual({ status: 'loading' });
  });

  test('opens the fixed production business center in production mode', async () => {
    const { controller, parentWindow } = createController(false);
    const bounds = { x: 10, y: 20, width: 800, height: 600 };

    await expect(controller.open(bounds)).resolves.toBe(true);

    expect(mocks.persistentController.open).toHaveBeenCalledWith({
      parentWindow,
      url: 'https://qiye.srmtj.com',
      bounds,
      visible: true,
      focus: false,
    });
  });

  test('does not report success when the persistent view closes while opening', async () => {
    mocks.persistentController.open.mockResolvedValueOnce({
      status: 'closed',
    });
    const { controller, statuses } = createController();

    await expect(controller.open({
      x: 10,
      y: 20,
      width: 800,
      height: 600,
    })).resolves.toBe(false);

    expect(statuses.at(-1)).toEqual({ status: 'error' });
  });

  test('does not report a superseded open as successful after close', async () => {
    let resolveOpen!: (result: { status: 'closed' }) => void;
    const openResult = new Promise<{ status: 'closed' }>(resolve => {
      resolveOpen = resolve;
    });
    mocks.persistentController.open.mockImplementationOnce(async () => {
      mocks.persistentController.webContents = {};
      return openResult;
    });
    const { controller } = createController();

    const opening = controller.open({
      x: 10,
      y: 20,
      width: 800,
      height: 600,
    });
    await controller.close();
    resolveOpen({ status: 'closed' });

    await expect(opening).resolves.toBe(false);
  });

  test('reuses the live view without navigating again after renderer remount', async () => {
    const { controller } = createController();
    const initialBounds = { x: 10, y: 20, width: 800, height: 600 };
    const nextBounds = { x: 20, y: 30, width: 900, height: 650 };

    await controller.open(initialBounds);
    await controller.open(nextBounds);

    expect(mocks.persistentController.open).toHaveBeenCalledOnce();
    expect(mocks.persistentController.setBounds).toHaveBeenCalledWith(nextBounds);
    expect(mocks.persistentController.show).toHaveBeenCalledOnce();
  });

  test('keeps same-origin popups inside the view and opens external URLs outside', () => {
    createController();
    const windowOpenHandler = mocks.webContents.setWindowOpenHandler.mock.calls[0][0];

    expect(windowOpenHandler({ url: 'http://127.0.0.1:3107/users?page=2' })).toEqual({
      action: 'deny',
    });
    expect(mocks.webContents.loadURL).toHaveBeenCalledWith(
      'http://127.0.0.1:3107/users?page=2',
    );

    expect(windowOpenHandler({ url: 'https://example.com/help' })).toEqual({
      action: 'deny',
    });
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/help');
  });

  test('blocks external navigation in the view', () => {
    createController();
    const event = { preventDefault: vi.fn() };

    mocks.emit('will-navigate', event, 'https://example.com/help');

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/help');
  });

  test('invalidates native auth once and remains hidden when navigation reaches login', async () => {
    const { controller, onSessionInvalidated } = createController();
    await controller.open({ x: 0, y: 0, width: 800, height: 600 });

    mocks.emit(
      'did-navigate-in-page',
      {},
      'http://127.0.0.1:3107/login',
    );
    mocks.emit(
      'did-navigate',
      {},
      'http://127.0.0.1:3107/login',
    );
    mocks.emit('did-finish-load');

    expect(mocks.persistentController.hide).toHaveBeenCalledOnce();
    expect(mocks.persistentController.show).not.toHaveBeenCalled();
    expect(onSessionInvalidated).toHaveBeenCalledOnce();
  });

  test('invalidates production auth when the admin portal returns to its login route', async () => {
    const { controller, onSessionInvalidated } = createController(false);
    await controller.open({ x: 0, y: 0, width: 800, height: 600 });

    mocks.emit('did-navigate', {}, 'https://qiye.srmtj.com/admin/login');

    expect(mocks.persistentController.hide).toHaveBeenCalledOnce();
    expect(onSessionInvalidated).toHaveBeenCalledOnce();
  });

  test('hides the native view and reports main-frame load failures', () => {
    const { statuses } = createController();

    mocks.emit(
      'did-fail-load',
      {},
      -102,
      'Connection refused',
      'http://127.0.0.1:3107',
      true,
    );

    expect(mocks.persistentController.hide).toHaveBeenCalledOnce();
    expect(statuses).toContainEqual({
      status: 'error',
      error: 'Connection refused',
    });
  });
});
