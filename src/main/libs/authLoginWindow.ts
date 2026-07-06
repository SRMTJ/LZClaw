import {
  BrowserWindow,
  shell,
  type BrowserWindowConstructorOptions,
} from 'electron';

import { AuthLoginWebviewPartition } from '../../shared/auth/constants';
import {
  getUrlOrigin,
  isAllowedAuthLoginNavigation,
  isHttpUrl,
  rememberAuthLoginRedirectOrigin,
} from './authLoginWindowPolicy';

interface OpenAuthLoginWindowOptions {
  loginUrl: string;
  parent?: BrowserWindow | null;
  isDev?: boolean;
  onClosed?: () => void;
}

let activeAuthLoginWindow: BrowserWindow | null = null;

export const closeActiveAuthLoginWindow = (): void => {
  const win = activeAuthLoginWindow;
  activeAuthLoginWindow = null;
  if (win && !win.isDestroyed()) {
    win.close();
  }
};

export const openAuthLoginWindow = async ({
  loginUrl,
  parent,
  isDev = false,
  onClosed,
}: OpenAuthLoginWindowOptions): Promise<void> => {
  closeActiveAuthLoginWindow();

  const initialOrigin = getUrlOrigin(loginUrl);
  if (!initialOrigin) {
    throw new Error('Auth login URL must be http or https.');
  }

  const allowedOrigins = new Set<string>([initialOrigin]);
  let lastAllowedMainFrameUrl = loginUrl;
  let closed = false;

  const windowOptions: BrowserWindowConstructorOptions = {
    width: 1040,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    title: 'LZClaw 企业账号登录',
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    modal: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f8f9fb',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
      partition: AuthLoginWebviewPartition,
      spellcheck: false,
      enableWebSQL: false,
      disableDialogs: true,
      navigateOnDragDrop: false,
    },
  };

  const win = new BrowserWindow(windowOptions);
  activeAuthLoginWindow = win;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (activeAuthLoginWindow === win) {
      activeAuthLoginWindow = null;
    }
    onClosed?.();
  };

  win.once('closed', cleanup);
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAuthLoginNavigation(url, allowedOrigins)) {
      setImmediate(() => {
        if (!win.isDestroyed()) {
          void win.loadURL(url);
        }
      });
    } else if (isHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    if (isAllowedAuthLoginNavigation(url, allowedOrigins)) {
      lastAllowedMainFrameUrl = url;
      return;
    }
    if (rememberAuthLoginRedirectOrigin(url, lastAllowedMainFrameUrl, allowedOrigins)) {
      lastAllowedMainFrameUrl = url;
      return;
    }
    event.preventDefault();
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAuthLoginNavigation(url, allowedOrigins)) {
      lastAllowedMainFrameUrl = url;
      return;
    }
    event.preventDefault();
    if (isHttpUrl(url)) {
      void shell.openExternal(url);
    }
  });

  win.webContents.on('did-start-navigation', (_event, url, _isInPlace, isMainFrame) => {
    if (isMainFrame && isAllowedAuthLoginNavigation(url, allowedOrigins)) {
      lastAllowedMainFrameUrl = url;
    }
  });

  try {
    await win.loadURL(loginUrl);
  } catch (error) {
    cleanup();
    if (!win.isDestroyed()) {
      win.close();
    }
    throw error;
  }
};
