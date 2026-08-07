import { PersistentViewController } from '@fudanda/electron-persistent-view';
import {
  type BrowserWindow,
  type Rectangle,
  type Session,
  type WebContents,
} from 'electron';

import type { AuthLoginInAppBounds } from '../../shared/auth/constants';
import {
  appendCallbackReturnTo,
  appendLoginParams,
  type AuthLocalCallback,
  startAuthLocalCallback,
} from './authLocalCallbackServer';
import { isPersistentViewOpened } from './persistentViewOpenResult';

const AUTH_LOGIN_MIN_WIDTH = 320;
const AUTH_LOGIN_MIN_HEIGHT = 280;
const AUTH_DEEP_LINK_PREFIX = 'lobsterai://';

interface AuthInAppLoginViewControllerOptions {
  getMainWindow: () => BrowserWindow | null;
  session: Session;
  isDev: boolean;
  onAuthCode: (code: string, codeVerifier: string) => void;
  onAuthDeepLink: (url: string) => void;
  isAllowedNavigation: (url: string) => boolean;
  isAuthenticatedNavigation: (url: string) => boolean;
  onAuthenticatedNavigation: (url: string) => Promise<boolean>;
}

interface OpenAuthInAppLoginViewOptions {
  loginUrl: string;
  bounds: AuthLoginInAppBounds;
}

const normalizeBounds = (bounds: AuthLoginInAppBounds): Rectangle | null => {
  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every(value => Number.isFinite(value))) return null;

  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  if (width < AUTH_LOGIN_MIN_WIDTH || height < AUTH_LOGIN_MIN_HEIGHT) return null;

  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width,
    height,
  };
};

const isHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export class AuthInAppLoginViewController {
  private readonly viewController: PersistentViewController;
  private localCallback: AuthLocalCallback | null = null;
  private operationId = 0;
  private activeLoginUrl: string | null = null;
  private authenticatedNavigationPending = false;

  constructor(private readonly options: AuthInAppLoginViewControllerOptions) {
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
      },
    });
  }

  async open(options: OpenAuthInAppLoginViewOptions): Promise<void> {
    const operationId = ++this.operationId;
    await this.closeActiveSurface();

    const parentWindow = this.options.getMainWindow();
    if (!parentWindow || parentWindow.isDestroyed()) {
      throw new Error('Main window is unavailable for embedded login');
    }

    const bounds = normalizeBounds(options.bounds);
    if (!bounds) {
      throw new Error('Embedded login bounds are invalid');
    }
    if (!isHttpUrl(options.loginUrl) || !this.options.isAllowedNavigation(options.loginUrl)) {
      throw new Error('Embedded login URL is not trusted');
    }

    let localCallback: AuthLocalCallback | null = null;
    try {
      localCallback = await startAuthLocalCallback({
        onCode: (code, codeVerifier) => {
          this.options.onAuthCode(code, codeVerifier);
        },
        onTimeout: () => {
          if (operationId !== this.operationId) return;
          console.warn('[AuthInAppLogin] local callback expired; closing embedded login view');
          void this.close().catch(error => {
            console.error('[AuthInAppLogin] failed to close expired embedded login view:', error);
          });
        },
      });

      if (operationId !== this.operationId) {
        await localCallback.close();
        throw new Error('Embedded login was cancelled');
      }

      this.localCallback = localCallback;
      const returnTo = appendLoginParams(options.loginUrl, {
        source: 'electron',
        electronLogin: 'success',
      });
      const finalUrl = appendLoginParams(options.loginUrl, {
        source: 'electron',
        redirect_uri: appendCallbackReturnTo(localCallback.redirectUri, returnTo),
        state: localCallback.state,
        code_challenge: localCallback.codeChallenge,
      });
      this.activeLoginUrl = finalUrl;

      const openResult = await this.viewController.open({
        parentWindow,
        url: finalUrl,
        bounds,
        focus: true,
      });
      if (!isPersistentViewOpened(openResult)) {
        throw new Error('Embedded login was cancelled');
      }
    } catch (error) {
      if (operationId === this.operationId) {
        await this.closeActiveSurface();
      } else {
        await localCallback?.close();
      }
      throw error;
    }
  }

  updateBounds(bounds: AuthLoginInAppBounds): boolean {
    const normalized = normalizeBounds(bounds);
    return normalized ? this.viewController.setBounds(normalized) : false;
  }

  async close(): Promise<void> {
    this.operationId += 1;
    await this.closeActiveSurface();
  }

  private configureNavigation(webContents: WebContents): void {
    const handleNavigation = (
      event: { preventDefault: () => void },
      url: string,
    ): void => {
      if (url.startsWith(AUTH_DEEP_LINK_PREFIX)) {
        event.preventDefault();
        this.options.onAuthDeepLink(url);
        void this.closeLocalCallback();
        return;
      }

      if (
        url !== 'about:blank'
        && (!isHttpUrl(url) || (
          !this.options.isAllowedNavigation(url)
          && !this.isActiveLocalCallbackNavigation(url)
        ))
      ) {
        event.preventDefault();
        console.warn(`[AuthInAppLogin] blocked untrusted navigation: ${url}`);
      }
    };

    webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith(AUTH_DEEP_LINK_PREFIX)) {
        this.options.onAuthDeepLink(url);
        void this.closeLocalCallback();
        return { action: 'deny' };
      }
      if (
        isHttpUrl(url)
        && (
          this.options.isAllowedNavigation(url)
          || this.isActiveLocalCallbackNavigation(url)
        )
      ) {
        void webContents.loadURL(url).catch(error => {
          console.error('[AuthInAppLogin] failed to load login popup in the embedded view:', error);
        });
      } else {
        console.warn(`[AuthInAppLogin] blocked untrusted popup: ${url}`);
      }
      return { action: 'deny' };
    });
    webContents.on('will-navigate', handleNavigation);
    webContents.on('will-redirect', handleNavigation);
    webContents.on('did-navigate', (_event, url) => {
      this.handleAuthenticatedNavigation(webContents, url);
    });
    webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) {
        this.handleAuthenticatedNavigation(webContents, url);
      }
    });
  }

  private isActiveLocalCallbackNavigation(url: string): boolean {
    const redirectUri = this.localCallback?.redirectUri;
    if (!redirectUri) return false;
    try {
      const candidate = new URL(url);
      const expected = new URL(redirectUri);
      return candidate.origin === expected.origin
        && candidate.pathname === expected.pathname
        && candidate.username === ''
        && candidate.password === ''
        && candidate.hash === '';
    } catch {
      return false;
    }
  }

  private handleAuthenticatedNavigation(webContents: WebContents, url: string): void {
    const retryUrl = this.activeLoginUrl;
    if (
      !retryUrl
      || this.authenticatedNavigationPending
      || !this.options.isAuthenticatedNavigation(url)
    ) {
      return;
    }

    const operationId = this.operationId;
    this.authenticatedNavigationPending = true;
    void this.options.onAuthenticatedNavigation(url)
      .then(recovered => {
        if (operationId !== this.operationId || recovered) return;
        this.authenticatedNavigationPending = false;
        return webContents.loadURL(retryUrl);
      })
      .catch(error => {
        if (operationId !== this.operationId) return;
        this.authenticatedNavigationPending = false;
        console.warn('[AuthInAppLogin] failed to recover the authenticated web session:', error);
        return webContents.loadURL(retryUrl).catch(loadError => {
          console.error('[AuthInAppLogin] failed to restore the embedded login page:', loadError);
        });
      });
  }

  private async closeLocalCallback(): Promise<void> {
    const localCallback = this.localCallback;
    this.localCallback = null;
    await localCallback?.close();
  }

  private async closeActiveSurface(): Promise<void> {
    this.activeLoginUrl = null;
    this.authenticatedNavigationPending = false;
    const localCallback = this.localCallback;
    this.localCallback = null;
    await Promise.all([
      this.viewController.close(),
      localCallback?.close() ?? Promise.resolve(),
    ]);
  }
}
