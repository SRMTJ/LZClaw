import { app } from 'electron';

import { HtmlSharePublicRoute } from '../../shared/htmlShare/constants';
import type { SqliteStore } from '../sqliteStore';

let cachedTestMode: boolean | null = null;
let cachedEnterpriseServerApiBaseUrl: string | null = null;
let cachedAppConfigServerApiBaseUrl: string | null = null;

const normalizeBaseUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
};

/**
 * Read testMode from store and cache it.
 * Call once at startup and again whenever app_config changes.
 */
export function refreshEndpointsTestMode(store: SqliteStore): void {
  const appConfig = store.get<any>('app_config');
  const enterpriseConfig = store.get<any>('enterprise_config');
  cachedTestMode = appConfig?.app?.testMode === true;
  cachedEnterpriseServerApiBaseUrl = normalizeBaseUrl(enterpriseConfig?.auth?.apiBaseUrl);
  cachedAppConfigServerApiBaseUrl =
    normalizeBaseUrl(appConfig?.auth?.apiBaseUrl)
    ?? normalizeBaseUrl(appConfig?.app?.serverApiBaseUrl);
}

/**
 * Whether the app is in test mode.
 * Uses cached value after init; falls back to !app.isPackaged before init.
 */
export const isTestModeEnabled = (): boolean => {
  return cachedTestMode ?? !app.isPackaged;
};

/**
 * Server API base URL.
 * Used for auth exchange/refresh, models, proxy, etc.
 */
export const getServerApiBaseUrl = (): string => {
  const envOverride = normalizeBaseUrl(process.env.LZCLAW_SERVER_API_BASE_URL);
  if (cachedEnterpriseServerApiBaseUrl) return cachedEnterpriseServerApiBaseUrl;
  if (envOverride) return envOverride;
  if (!app.isPackaged) return 'http://127.0.0.1:8081';
  if (cachedAppConfigServerApiBaseUrl) return cachedAppConfigServerApiBaseUrl;
  return isTestModeEnabled()
    ? 'https://lobsterai-server.inner.youdao.com'
    : 'https://lobsterai-server.youdao.com';
};

export const getHtmlSharePublicBaseUrl = (): string => {
  return `${getServerApiBaseUrl()}${HtmlSharePublicRoute.Root}`;
};

export const getUpdateCheckUrl = (): string => (
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/update'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/update'
);

export const getManualUpdateCheckUrl = (): string => (
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/update-manual'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/update-manual'
);

export const getFallbackDownloadUrl = (): string => (
  isTestModeEnabled()
    ? 'https://lobsterai.inner.youdao.com/#/download-list'
    : 'https://lobsterai.youdao.com/#/download-list'
);

export const getSkillStoreUrl = (): string => (
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/skill-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/skill-store'
);

// Portal 页面
const PORTAL_BASE_TEST = 'https://lobsterai.inner.youdao.com/portal#';
const PORTAL_BASE_PROD = 'https://lobsterai.youdao.com/portal#';

const getPortalBase = (): string => isTestModeEnabled() ? PORTAL_BASE_TEST : PORTAL_BASE_PROD;

export const getPortalTasksUrl = (): string => `${getPortalBase()}/profile/detail?tab=tasks`;

export const getKitStoreUrl = (): string => (
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/kit-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/kit-store'
);
