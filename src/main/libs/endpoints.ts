import { app } from 'electron';

import { HtmlSharePublicRoute } from '../../shared/htmlShare/constants';
import {
  buildLzServiceEndpoints,
  getLzServiceDefaultBaseUrl,
  LZ_SERVICE_ENVIRONMENTS,
  normalizeLzServiceBaseUrl,
} from '../../shared/lzServiceConfig';
import type { SqliteStore } from '../sqliteStore';

let cachedTestMode: boolean | null = null;

/**
 * Read testMode from store and cache it.
 * Call once at startup and again whenever app_config changes.
 */
export function refreshEndpointsTestMode(store: SqliteStore): void {
  const appConfig = store.get<any>('app_config');
  cachedTestMode = appConfig?.app?.testMode === true;
}

/**
 * Whether the app is in test mode.
 * Uses cached value after init; falls back to !app.isPackaged before init.
 */
export const isTestModeEnabled = (): boolean => {
  return cachedTestMode ?? !app.isPackaged;
};

const getLzServiceBaseUrl = (): string => (
  normalizeLzServiceBaseUrl(
    process.env.LZ_SERVICE_BASE_URL
    || getLzServiceDefaultBaseUrl({ isPackaged: app.isPackaged, nodeEnv: process.env.NODE_ENV }),
  )
);

const getLzServiceEnvironment = () => (
  isTestModeEnabled() ? LZ_SERVICE_ENVIRONMENTS.Test : LZ_SERVICE_ENVIRONMENTS.Prod
);

const getLzServiceEndpoints = () => (
  buildLzServiceEndpoints(getLzServiceBaseUrl(), getLzServiceEnvironment())
);

/**
 * Server API base URL — switches based on testMode.
 * Used for auth exchange/refresh, models, proxy, etc.
 */
export const getServerApiBaseUrl = (): string => {
  return getLzServiceEndpoints().serverApiBaseUrl;
};

export const getHtmlSharePublicBaseUrl = (): string => {
  return `${getServerApiBaseUrl()}${HtmlSharePublicRoute.Root}`;
};

export const getUpdateCheckUrl = (): string => (
  getLzServiceEndpoints().updateUrl
);

export const getManualUpdateCheckUrl = (): string => (
  getLzServiceEndpoints().manualUpdateUrl
);

export const getFallbackDownloadUrl = (): string => (
  isTestModeEnabled()
    ? 'https://lobsterai.inner.youdao.com/#/download-list'
    : 'https://lobsterai.youdao.com/#/download-list'
);

export const getSkillStoreUrl = (): string => (
  getLzServiceEndpoints().skillStoreUrl
);

export const getAgentTemplateUrl = (): string => (
  getLzServiceEndpoints().agentTemplateUrl
);

export const getLoginUrlEndpoint = (): string => (
  getLzServiceEndpoints().loginUrl
);

// Portal 页面
const PORTAL_BASE_TEST = 'https://c.youdao.com/dict/hardware/cowork/lobsterai-portal.html#';
const PORTAL_BASE_PROD = 'https://c.youdao.com/dict/hardware/octopus/lobsterai-portal.html#';

const getPortalBase = (): string => isTestModeEnabled() ? PORTAL_BASE_TEST : PORTAL_BASE_PROD;

export const getPortalTasksUrl = (): string => `${getPortalBase()}/profile/detail?tab=tasks`;

export const getKitStoreUrl = (): string => (
  isTestModeEnabled()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/kit-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/kit-store'
);
