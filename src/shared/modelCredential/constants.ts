export const EnterpriseModelCredentialProvider = {
  SuperGateway: 'super_gateway',
} as const;

export type EnterpriseModelCredentialProvider =
  typeof EnterpriseModelCredentialProvider[keyof typeof EnterpriseModelCredentialProvider];

export type EnterpriseModelCredential = {
  provider: EnterpriseModelCredentialProvider;
  tenantId: string;
  baseUrl: string;
  apiKey: string;
};

const containsControlCharacter = (value: string): boolean => [...value].some(character => {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f;
});

export const isEnterpriseModelCredential = (
  value: unknown,
  isDevelopment: boolean,
): value is EnterpriseModelCredential => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.provider !== EnterpriseModelCredentialProvider.SuperGateway
    || typeof candidate.tenantId !== 'string'
    || candidate.tenantId.trim() !== candidate.tenantId
    || candidate.tenantId.length === 0
    || candidate.tenantId.length > 100
    || typeof candidate.apiKey !== 'string'
    || candidate.apiKey.trim() !== candidate.apiKey
    || candidate.apiKey.length < 16
    || candidate.apiKey.length > 256
    || containsControlCharacter(candidate.apiKey)
    || typeof candidate.baseUrl !== 'string'
  ) return false;
  try {
    const url = new URL(candidate.baseUrl);
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.protocol === 'https:') return true;
    return isDevelopment
      && url.protocol === 'http:'
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch {
    return false;
  }
};
