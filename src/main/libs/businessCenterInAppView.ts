import { PersistentViewController } from '@fudanda/electron-persistent-view';
import {
  type BrowserWindow,
  type Session,
  shell,
  type WebContents,
} from 'electron';

import {
  type BusinessCenterStatusUpdate,
  type BusinessCenterViewBounds,
  resolveBusinessCenterPageUrl,
} from '../../shared/businessCenter/constants';
import { isPersistentViewOpened } from './persistentViewOpenResult';

const BUSINESS_CENTER_LOGIN_PATHS = new Set([
  '/login',
  '/admin/login',
  '/employee/login',
]);

interface BusinessCenterInAppViewControllerOptions {
  getMainWindow: () => BrowserWindow | null;
  getAuthenticatedEntryUrl: () => string | null;
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

export class BusinessCenterInAppViewController {
  private readonly viewController: PersistentViewController;
  private readonly businessCenterUrl: string;
  private readonly businessCenterOrigin: string;
  private lastBounds: BusinessCenterViewBounds | null = null;
  private lastStatus: BusinessCenterStatusUpdate = { status: 'idle' };
  private sessionInvalidated = false;
  private shouldBeVisible = false;
  private operationId = 0;

  constructor(
    private readonly options: BusinessCenterInAppViewControllerOptions,
  ) {
    this.businessCenterUrl = resolveBusinessCenterPageUrl(options.isDev);
    this.businessCenterOrigin = new URL(this.businessCenterUrl).origin;
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

  async open(bounds: BusinessCenterViewBounds): Promise<boolean> {
    const operationId = ++this.operationId;
    const parentWindow = this.options.getMainWindow();
    if (!parentWindow || parentWindow.isDestroyed()) {
      throw new Error('Main window is unavailable for the business center');
    }

    this.lastBounds = bounds;
    this.sessionInvalidated = false;
    this.shouldBeVisible = true;
    const openUrl = this.resolveOpenUrl();
    const existingWebContents = this.viewController.webContents;
    if (existingWebContents) {
      this.viewController.setBounds(bounds);
      if (this.shouldNavigateToOpenUrl(existingWebContents.getURL(), openUrl)) {
        this.reportStatus({ status: 'loading' });
        await existingWebContents.loadURL(openUrl);
        if (operationId !== this.operationId) {
          return false;
        }
      }
      if (this.lastStatus.status !== 'error') {
        this.viewController.show();
      }
      this.reportStatus(this.lastStatus);
      return true;
    }

    this.reportStatus({ status: 'loading' });
    const openResult = await this.viewController.open({
      parentWindow,
      url: openUrl,
      bounds,
      visible: this.shouldBeVisible,
      focus: false,
    });
    if (operationId !== this.operationId) {
      return (
        this.shouldBeVisible
        && this.viewController.webContents !== null
      );
    }
    if (!isPersistentViewOpened(openResult)) {
      this.shouldBeVisible = false;
      this.reportStatus({ status: 'error' });
      return false;
    }
    return true;
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
    return this.open(this.lastBounds);
  }

  async close(): Promise<void> {
    this.operationId += 1;
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
      if (url === 'about:blank' || this.isBusinessCenterUrl(url)) return;
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
      if (this.isBusinessCenterUrl(url)) {
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
          parsed.origin === this.businessCenterOrigin
          && BUSINESS_CENTER_LOGIN_PATHS.has(parsed.pathname)
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

  private isBusinessCenterUrl(url: string): boolean {
    try {
      return new URL(url).origin === this.businessCenterOrigin;
    } catch {
      return false;
    }
  }

  private resolveOpenUrl(): string {
    const authenticatedEntryUrl = this.options.getAuthenticatedEntryUrl();
    return authenticatedEntryUrl && this.isBusinessCenterUrl(authenticatedEntryUrl)
      ? authenticatedEntryUrl
      : this.businessCenterUrl;
  }

  private shouldNavigateToOpenUrl(currentUrl: string, openUrl: string): boolean {
    if (openUrl === this.businessCenterUrl) return false;
    try {
      const current = new URL(currentUrl);
      const target = new URL(openUrl);
      if (current.origin !== target.origin) return true;
      if (BUSINESS_CENTER_LOGIN_PATHS.has(current.pathname)) return true;

      const targetPath = target.pathname.replace(/\/$/, '');
      return current.pathname !== targetPath
        && !current.pathname.startsWith(`${targetPath}/`);
    } catch {
      return true;
    }
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
