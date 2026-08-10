import type { ServerModelMetadataInput } from './claudeSettings';

export const ClientModelCatalogStatus = {
  Success: 'success',
  Stale: 'stale',
  Disabled: 'disabled',
} as const;

export type ClientModelCatalogStatus =
  typeof ClientModelCatalogStatus[keyof typeof ClientModelCatalogStatus];

export type ClientModelCatalogModel = ServerModelMetadataInput & {
  modelId: string;
  modelName: string;
  provider: string;
  apiFormat: 'openai' | 'anthropic';
  platforms: string[];
  accessible: boolean;
  costMultiplier?: number;
  description?: string;
  restrictionHint?: string;
};

export type ClientModelCatalog = {
  status: ClientModelCatalogStatus;
  syncedAt?: string;
  models: ClientModelCatalogModel[];
};

const EXPECTED_APP_CODE = 'claw';
const EXPECTED_SOURCE = 'super_gateway';
const MAX_MODELS = 2_000;
const MAX_MODEL_TEXT_LENGTH = 256;
const MAX_PROVIDER_LENGTH = 64;
const MAX_PLATFORMS = 32;
const MAX_PLATFORM_LENGTH = 64;
const SUPPORTED_API_FORMATS = new Set(['openai', 'anthropic']);
const SUPPORTED_STATUSES = new Set<string>(Object.values(ClientModelCatalogStatus));

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readRequiredText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
};

const readPlatforms = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MAX_PLATFORMS) return null;
  const platforms: string[] = [];
  for (const entry of value) {
    const platform = readRequiredText(entry, MAX_PLATFORM_LENGTH);
    if (!platform) return null;
    platforms.push(platform);
  }
  return platforms;
};

const parseModel = (value: unknown): ClientModelCatalogModel | null => {
  if (!isRecord(value)) return null;
  const modelId = readRequiredText(value.modelId, MAX_MODEL_TEXT_LENGTH);
  const modelName = readRequiredText(value.modelName, MAX_MODEL_TEXT_LENGTH);
  const provider = readRequiredText(value.provider, MAX_PROVIDER_LENGTH);
  const apiFormat = readRequiredText(value.apiFormat, MAX_PROVIDER_LENGTH);
  const platforms = readPlatforms(value.platforms);
  if (
    !modelId
    || !modelName
    || !provider
    || !apiFormat
    || !SUPPORTED_API_FORMATS.has(apiFormat)
    || !platforms
    || typeof value.accessible !== 'boolean'
  ) {
    return null;
  }
  return {
    modelId,
    modelName,
    provider,
    apiFormat: apiFormat as ClientModelCatalogModel['apiFormat'],
    platforms,
    accessible: value.accessible,
  };
};

export const parseClientModelCatalogResponse = (value: unknown): ClientModelCatalog => {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data)) {
    throw new Error('Client model catalog response is invalid.');
  }
  const { data } = value;
  const status = readRequiredText(data.status, 32);
  if (
    data.appCode !== EXPECTED_APP_CODE
    || data.source !== EXPECTED_SOURCE
    || !status
    || !SUPPORTED_STATUSES.has(status)
    || !Array.isArray(data.models)
    || data.models.length > MAX_MODELS
  ) {
    throw new Error('Client model catalog response is invalid.');
  }

  const models: ClientModelCatalogModel[] = [];
  const modelIds = new Set<string>();
  for (const entry of data.models) {
    const model = parseModel(entry);
    const normalizedId = model?.modelId.toLowerCase();
    if (!model || !normalizedId || modelIds.has(normalizedId)) {
      throw new Error('Client model catalog response is invalid.');
    }
    modelIds.add(normalizedId);
    models.push(model);
  }

  const syncedAt = data.syncedAt === null || data.syncedAt === undefined
    ? undefined
    : readRequiredText(data.syncedAt, 64);
  if (data.syncedAt !== null && data.syncedAt !== undefined && !syncedAt) {
    throw new Error('Client model catalog response is invalid.');
  }

  return {
    status: status as ClientModelCatalogStatus,
    syncedAt,
    models,
  };
};

export const fetchClientModelCatalog = async (
  url: string,
  fetchPublic: (url: string, options?: RequestInit) => Promise<Response>,
  timeoutMs = 5_000,
): Promise<ClientModelCatalog> => {
  const response = await fetchPublic(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Client model catalog request failed with HTTP ${response.status}.`);
  }
  return parseClientModelCatalogResponse(await response.json());
};
