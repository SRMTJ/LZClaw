export const isLoopbackAuthCallbackUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:'
      && parsed.pathname === '/auth/callback'
      && parsed.port !== ''
      && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  } catch {
    return false;
  }
};

export const isHttpUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const getUrlOrigin = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

export const isAllowedAuthLoginNavigation = (
  rawUrl: string,
  allowedOrigins: ReadonlySet<string>,
): boolean => {
  if (isLoopbackAuthCallbackUrl(rawUrl)) return true;
  const origin = getUrlOrigin(rawUrl);
  return Boolean(origin && allowedOrigins.has(origin));
};

export const rememberAuthLoginRedirectOrigin = (
  redirectUrl: string,
  previousMainFrameUrl: string,
  allowedOrigins: Set<string>,
): boolean => {
  if (!isAllowedAuthLoginNavigation(previousMainFrameUrl, allowedOrigins)) {
    return false;
  }
  const origin = getUrlOrigin(redirectUrl);
  if (!origin) return false;
  allowedOrigins.add(origin);
  return true;
};
