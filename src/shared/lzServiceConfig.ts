export const LZ_SERVICE_DEFAULT_BASE_URL = 'http://127.0.0.1:5000';

export const LZ_SERVICE_ENVIRONMENTS = {
  Test: 'test',
  Prod: 'prod',
} as const;

export type LzServiceEnvironment =
  typeof LZ_SERVICE_ENVIRONMENTS[keyof typeof LZ_SERVICE_ENVIRONMENTS];

const LZ_SERVICE_OPENAPI_BASE_PATH = '/openapi/get/luna/hardware/lobsterai';

const trimTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, '');

export const normalizeLzServiceBaseUrl = (baseUrl?: string | null): string => {
  const normalized = trimTrailingSlash(baseUrl || LZ_SERVICE_DEFAULT_BASE_URL);
  return normalized || LZ_SERVICE_DEFAULT_BASE_URL;
};

const openApiUrl = (
  baseUrl: string,
  environment: LzServiceEnvironment,
  route: string,
): string => `${normalizeLzServiceBaseUrl(baseUrl)}${LZ_SERVICE_OPENAPI_BASE_PATH}/${environment}/${route}`;

export const buildLzServiceEndpoints = (
  baseUrl: string,
  environment: LzServiceEnvironment,
) => ({
  serverApiBaseUrl: normalizeLzServiceBaseUrl(baseUrl),
  loginUrl: openApiUrl(baseUrl, environment, 'login-url'),
  updateUrl: openApiUrl(baseUrl, environment, 'update'),
  manualUpdateUrl: openApiUrl(baseUrl, environment, 'update-manual'),
});

