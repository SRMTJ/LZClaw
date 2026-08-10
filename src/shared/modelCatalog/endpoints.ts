export const LzClawModelCatalogAppCode = 'claw';

const DEVELOPMENT_MODEL_CATALOG_BASE_URL = 'http://127.0.0.1:8080';
const PRODUCTION_MODEL_CATALOG_BASE_URL = 'https://zhongtai.srmtj.com';

export const resolveLzClawModelCatalogUrl = (isDevelopment: boolean): string => {
  const baseUrl = isDevelopment
    ? DEVELOPMENT_MODEL_CATALOG_BASE_URL
    : PRODUCTION_MODEL_CATALOG_BASE_URL;
  return `${baseUrl}/api/client-models/${LzClawModelCatalogAppCode}/models`;
};
