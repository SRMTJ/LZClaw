import { PersistentViewController } from '@fudanda/electron-persistent-view';
import {
  type BrowserWindow,
  type Session,
  shell,
  type WebContents,
} from 'electron';

import type {
  BusinessCenterStatusUpdate,
  BusinessCenterViewBounds,
} from '../../shared/businessCenter/constants';

const BUSINESS_CENTER_URL = 'http://localhost:3100/users';
const BUSINESS_CENTER_ORIGIN = new URL(BUSINESS_CENTER_URL).origin;
const BUSINESS_CENTER_LOGIN_PATH = '/login';

interface BusinessCenterInAppViewControllerOptions {
  getMainWindow: () => BrowserWindow | null;
  session: Session;
  isDev: boolean;
  onStatus: (update: BusinessCenterStatusUpdate) => void;
  onSessionInvalidated: () => void;
}

const isHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isBusinessCenterUrl = (url: string): boolean => {
  try {
    return new URL(url).origin === BUSINESS_CENTER_ORIGIN;
  } catch {
    return false;
  }
};

export class BusinessCenterInAppViewController {
  private readonly viewController: PersistentViewController;
  private lastBounds: BusinessCenterViewBounds | null = null;
  private lastStatus: BusinessCenterStatusUpdate = { status: 'idle' };
  private sessionInvalidated = false;
  private shouldBeVisible = false;

  constructor(
    private readonly options: BusinessCenterInAppViewControllerOptions,
  ) {
    this.viewController = new PersistentViewController({
      session: options.session,
      backgroundColor: '#ffffff',
      borderRadius: 0,
      webPreferences: {
        devTools: options.isDev,
        enableWebSQL: false,
        disableDialogs: true,
        navigateOnDragDrop: false,
      },
      configureWebContents: ({ webContents }) => {
        this.configureNavigation(webContents);
        this.configureLoadStatus(webContents);
      },
    });
  }

  async open(bounds: BusinessCenterViewBounds): Promise<void> {
    const parentWindow = this.options.getMainWindow();
    if (!parentWindow || parentWindow.isDestroyed()) {
      throw new Error('Main window is unavailable for the business center');
    }

    this.lastBounds = bounds;
    this.sessionInvalidated = false;
    this.shouldBeVisible = true;
    if (this.viewController.webContents) {
      this.viewController.setBounds(bounds);
      if (this.lastStatus.status !== 'error') {
        this.viewController.show();
      }
      this.reportStatus(this.lastStatus);
      return;
    }

    this.reportStatus({ status: 'loading' });
    await this.viewController.open({
      parentWindow,
      url: BUSINESS_CENTER_URL,
      bounds,
      focus: false,
    });
  }

  updateBounds(bounds: BusinessCenterViewBounds): boolean {
    this.lastBounds = bounds;
    return this.viewController.setBounds(bounds);
  }

  setVisible(visible: boolean): boolean {
    this.shouldBeVisible = visible;
    return visible
      ? this.viewController.show()
      : this.viewController.hide();
  }

  async reload(): Promise<boolean> {
    this.reportStatus({ status: 'loading' });
    if (this.viewController.reload()) return true;
    if (!this.lastBounds) return false;
    await this.open(this.lastBounds);
    return true;
  }

  async close(): Promise<void> {
    this.lastBounds = null;
    this.shouldBeVisible = false;
    await this.viewController.close();
    this.reportStatus({ status: 'idle' });
  }

  async clearStorageData(): Promise<void> {
    await this.viewController.clearStorageData();
  }

  private configureNavigation(webContents: WebContents): void {
    const handleNavigation = (
      event: { preventDefault: () => void },
      url: string,
    ): void => {
      if (url === 'about:blank' || isBusinessCenterUrl(url)) return;
      event.preventDefault();
      if (isHttpUrl(url)) {
        void shell.openExternal(url).catch(error => {
          console.warn('[BusinessCenter] failed to open external URL:', error);
        });
      } else {
        console.warn(`[BusinessCenter] blocked unsupported navigation: ${url}`);
      }
    };

    webContents.setWindowOpenHandler(({ url }) => {
      if (isBusinessCenterUrl(url)) {
        void webContents.loadURL(url).catch(error => {
          console.warn('[BusinessCenter] failed to open internal popup URL:', error);
        });
      } else if (isHttpUrl(url)) {
        void shell.openExternal(url).catch(error => {
          console.warn('[BusinessCenter] failed to open external popup URL:', error);
        });
      } else {
        console.warn(`[BusinessCenter] blocked unsupported popup: ${url}`);
      }
      return { action: 'deny' };
    });
    webContents.on('will-navigate', handleNavigation);
    webContents.on('will-redirect', handleNavigation);

    const handleCompletedNavigation = (
      _event: unknown,
      url: string,
    ): void => {
      if (this.sessionInvalidated) return;
      try {
        const parsed = new URL(url);
        if (
          parsed.origin === BUSINESS_CENTER_ORIGIN
          && parsed.pathname === BUSINESS_CENTER_LOGIN_PATH
        ) {
          this.sessionInvalidated = true;
          this.shouldBeVisible = false;
          this.viewController.hide();
          this.options.onSessionInvalidated();
        }
      } catch {
        // Invalid URLs are already blocked by the navigation policy.
      }
    };

    webContents.on('did-navigate', handleCompletedNavigation);
    webContents.on('did-navigate-in-page', handleCompletedNavigation);
  }

  private configureLoadStatus(webContents: WebContents): void {
    webContents.on('did-start-loading', () => {
      this.reportStatus({ status: 'loading' });
    });
    webContents.on('did-finish-load', () => {
      if (this.shouldBeVisible) {
        this.viewController.show();
      }
      this.reportStatus({ status: 'ready' });
    });
    webContents.on(
      'did-fail-load',
      (
        _event,
        errorCode,
        errorDescription,
        _validatedURL,
        isMainFrame,
      ) => {
        if (!isMainFrame || errorCode === -3) return;
        this.viewController.hide();
        this.reportStatus({
          status: 'error',
          error: errorDescription || `Failed to load (${errorCode})`,
        });
      },
    );
  }

  private reportStatus(update: BusinessCenterStatusUpdate): void {
    this.lastStatus = update;
    this.options.onStatus(update);
  }
}
