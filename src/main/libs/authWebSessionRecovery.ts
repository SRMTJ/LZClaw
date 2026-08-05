export const AuthWebSessionRecoveryStatus = {
  Ignored: 'ignored',
  MissingCookie: 'missing_cookie',
  Recovered: 'recovered',
  Rejected: 'rejected',
} as const;

export type AuthWebSessionRecoveryStatus =
  typeof AuthWebSessionRecoveryStatus[keyof typeof AuthWebSessionRecoveryStatus];

interface WebSessionCookie {
  value: string;
}

interface AuthWebSessionRecoveryOptions {
  navigationUrl: string;
  portalOrigin: string;
  cookieName: string;
  getCookies: (filter: { url: string; name: string }) => Promise<WebSessionCookie[]>;
  refreshUrl: string;
  buildRefreshRequestBody: (refreshToken: string) => string;
  fetch: (url: string, options: RequestInit) => Promise<Response>;
}

export type AuthWebSessionRecoveryResult =
  | { status: typeof AuthWebSessionRecoveryStatus.Ignored }
  | { status: typeof AuthWebSessionRecoveryStatus.MissingCookie }
  | {
      status: typeof AuthWebSessionRecoveryStatus.Recovered;
      accessToken: string;
      refreshToken: string;
    }
  | {
      status: typeof AuthWebSessionRecoveryStatus.Rejected;
      httpStatus: number;
      errorCode?: number;
    };

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
);

const readNonEmptyString = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value : undefined
);

export const isAuthenticatedPortalNavigation = (
  navigationUrl: string,
  portalOrigin: string,
): boolean => {
  try {
    const navigation = new URL(navigationUrl);
    const expectedOrigin = new URL(portalOrigin).origin;
    return navigation.origin === expectedOrigin
      && (navigation.pathname === '/users' || navigation.pathname.startsWith('/users/'));
  } catch {
    return false;
  }
};

export const recoverAuthTokensFromWebSession = async (
  options: AuthWebSessionRecoveryOptions,
): Promise<AuthWebSessionRecoveryResult> => {
  if (!isAuthenticatedPortalNavigation(options.navigationUrl, options.portalOrigin)) {
    return { status: AuthWebSessionRecoveryStatus.Ignored };
  }

  const cookieUrl = `${new URL(options.portalOrigin).origin}/`;
  const cookies = await options.getCookies({
    url: cookieUrl,
    name: options.cookieName,
  });
  const refreshToken = cookies
    .map(cookie => readNonEmptyString(cookie.value))
    .find((value): value is string => value !== undefined);
  if (!refreshToken) {
    return { status: AuthWebSessionRecoveryStatus.MissingCookie };
  }

  const response = await options.fetch(options.refreshUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: options.buildRefreshRequestBody(refreshToken),
  });
  const body = asRecord(await response.json().catch((): null => null));
  const data = asRecord(body?.data);
  const errorCode = typeof body?.code === 'number' ? body.code : undefined;
  const accessToken = readNonEmptyString(data?.accessToken);
  if (!response.ok || errorCode !== 0 || !accessToken) {
    return {
      status: AuthWebSessionRecoveryStatus.Rejected,
      httpStatus: response.status,
      ...(errorCode === undefined ? {} : { errorCode }),
    };
  }

  return {
    status: AuthWebSessionRecoveryStatus.Recovered,
    accessToken,
    refreshToken: readNonEmptyString(data?.refreshToken) ?? refreshToken,
  };
};
