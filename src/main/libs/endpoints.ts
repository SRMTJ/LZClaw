import { app } from 'electron';

import {
  buildLzServiceEndpoints,
  LZ_SERVICE_DEFAULT_BASE_URL,
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
const isTestMode = (): boolean => {
  return cachedTestMode ?? !app.isPackaged;
};

const getLzServiceBaseUrl = (): string => (
  normalizeLzServiceBaseUrl(process.env.LZ_SERVICE_BASE_URL || LZ_SERVICE_DEFAULT_BASE_URL)
);

const getLzServiceEnvironment = () => (
  isTestMode() ? LZ_SERVICE_ENVIRONMENTS.Test : LZ_SERVICE_ENVIRONMENTS.Prod
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

export const getUpdateCheckUrl = (): string => (
  getLzServiceEndpoints().updateUrl
);

export const getManualUpdateCheckUrl = (): string => (
  getLzServiceEndpoints().manualUpdateUrl
);

export const getFallbackDownloadUrl = (): string => (
  isTestMode()
    ? 'https://lobsterai.inner.youdao.com/#/download-list'
    : 'https://lobsterai.youdao.com/#/download-list'
);

export const getSkillStoreUrl = (): string => (
  isTestMode()
    ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/skill-store'
    : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/skill-store'
);

export const getLoginUrlEndpoint = (): string => (
  getLzServiceEndpoints().loginUrl
);
