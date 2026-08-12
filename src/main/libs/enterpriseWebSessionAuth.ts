export const EnterpriseWebSessionEntryType = {
  Admin: 'admin',
  Employee: 'employee',
} as const;

export type EnterpriseWebSessionEntryType =
  typeof EnterpriseWebSessionEntryType[keyof typeof EnterpriseWebSessionEntryType];

export const EnterpriseWebSessionValidationStatus = {
  Ignored: 'ignored',
  Authenticated: 'authenticated',
  Expired: 'expired',
  Rejected: 'rejected',
  TemporarilyUnavailable: 'temporarily_unavailable',
} as const;

export type EnterpriseWebSessionValidationStatus =
  typeof EnterpriseWebSessionValidationStatus[keyof typeof EnterpriseWebSessionValidationStatus];

export interface EnterpriseWebSessionReference {
  entryType: EnterpriseWebSessionEntryType;
  origin: string;
  profileUrl: string;
  logoutUrl: string;
}

export interface EnterpriseDesktopUser extends Record<string, unknown> {
  yid: string;
  userId: string;
  id: string;
  nickname: string;
  role: string;
  status: 1;
  entryType: EnterpriseWebSessionEntryType;
  enterpriseId: string;
  enterpriseName: string;
  membershipId: string;
}

interface EnterpriseWebSessionTarget extends EnterpriseWebSessionReference {
  isDevelopment: boolean;
  pathPrefix: string;
}

interface EnterpriseWebSessionOptions {
  fetch: (url: string, options: RequestInit) => Promise<Response>;
  isDevelopment: boolean;
}

interface ValidateEnterpriseWebSessionOptions extends EnterpriseWebSessionOptions {
  reference: EnterpriseWebSessionReference;
}

interface RecoverEnterpriseWebSessionOptions extends EnterpriseWebSessionOptions {
  navigationUrl: string;
}

export type EnterpriseWebSessionValidationResult =
  | {
      status: typeof EnterpriseWebSessionValidationStatus.Authenticated;
      user: EnterpriseDesktopUser;
    }
  | {
      status: typeof EnterpriseWebSessionValidationStatus.Expired
        | typeof EnterpriseWebSessionValidationStatus.Rejected
        | typeof EnterpriseWebSessionValidationStatus.TemporarilyUnavailable;
    };

export type EnterpriseWebSessionRecoveryResult =
  | {
      status: typeof EnterpriseWebSessionValidationStatus.Authenticated;
      reference: EnterpriseWebSessionReference;
      user: EnterpriseDesktopUser;
    }
  | {
      status: typeof EnterpriseWebSessionValidationStatus.Ignored
        | typeof EnterpriseWebSessionValidationStatus.Expired
        | typeof EnterpriseWebSessionValidationStatus.Rejected
        | typeof EnterpriseWebSessionValidationStatus.TemporarilyUnavailable;
    };

const ENTERPRISE_WEB_SESSION_TARGETS: readonly EnterpriseWebSessionTarget[] = [
  {
    entryType: EnterpriseWebSessionEntryType.Admin,
    isDevelopment: true,
    origin: 'https://qiye.srmtj.com',
    pathPrefix: '/admin',
    profileUrl: 'https://qiye.srmtj.com/admin/api/v1/me',
    logoutUrl: 'https://qiye.srmtj.com/admin/auth/logout',
  },
  {
    entryType: EnterpriseWebSessionEntryType.Employee,
    isDevelopment: true,
    origin: 'https://qiye.srmtj.com',
    pathPrefix: '/employee',
    profileUrl: 'https://qiye.srmtj.com/employee/api/v1/me',
    logoutUrl: 'https://qiye.srmtj.com/employee/auth/logout',
  },
  {
    entryType: EnterpriseWebSessionEntryType.Admin,
    isDevelopment: false,
    origin: 'https://qiye.srmtj.com',
    pathPrefix: '/admin',
    profileUrl: 'https://qiye.srmtj.com/admin/api/v1/me',
    logoutUrl: 'https://qiye.srmtj.com/admin/auth/logout',
  },
  {
    entryType: EnterpriseWebSessionEntryType.Employee,
    isDevelopment: false,
    origin: 'https://qiye.srmtj.com',
    pathPrefix: '/employee',
    profileUrl: 'https://qiye.srmtj.com/employee/api/v1/me',
    logoutUrl: 'https://qiye.srmtj.com/employee/auth/logout',
  },
];

const NON_AUTHENTICATED_PORTAL_PATHS = new Set([
  '/handoff',
  '/login',
  '/login-result',
  '/no-entry',
]);

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
);

const readNonEmptyString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() === value && value.length > 0
    ? value
    : null
);

const publicReference = (target: EnterpriseWebSessionTarget): EnterpriseWebSessionReference => ({
  entryType: target.entryType,
  origin: target.origin,
  profileUrl: target.profileUrl,
  logoutUrl: target.logoutUrl,
});

export const resolveEnterpriseWebSessionReference = (
  entryType: EnterpriseWebSessionEntryType,
  isDevelopment: boolean,
): EnterpriseWebSessionReference | null => {
  const target = ENTERPRISE_WEB_SESSION_TARGETS.find(candidate => (
    candidate.entryType === entryType
    && candidate.isDevelopment === isDevelopment
  ));
  return target ? publicReference(target) : null;
};

const matchesTargetReference = (
  value: EnterpriseWebSessionReference,
  target: EnterpriseWebSessionTarget,
): boolean => value.entryType === target.entryType
  && value.origin === target.origin
  && value.profileUrl === target.profileUrl
  && value.logoutUrl === target.logoutUrl;

export const resolveEnterpriseWebSessionPortalUrl = (
  reference: EnterpriseWebSessionReference,
  isDevelopment: boolean,
): string | null => {
  const target = ENTERPRISE_WEB_SESSION_TARGETS.find(candidate => (
    candidate.isDevelopment === isDevelopment
    && matchesTargetReference(reference, candidate)
  ));
  return target
    ? new URL(`${target.pathPrefix}/`, target.origin).toString()
    : null;
};

export const isEnterpriseWebSessionReference = (
  value: unknown,
  isDevelopment: boolean,
): value is EnterpriseWebSessionReference => {
  const record = asRecord(value);
  if (!record) return false;
  const reference = record as unknown as EnterpriseWebSessionReference;
  return ENTERPRISE_WEB_SESSION_TARGETS.some(target => (
    target.isDevelopment === isDevelopment
    && matchesTargetReference(reference, target)
  ));
};

const resolveEnterpriseWebSessionNavigationTarget = (
  navigationUrl: string,
  isDevelopment: boolean,
): { navigation: URL; target: EnterpriseWebSessionTarget } | null => {
  try {
    const navigation = new URL(navigationUrl);
    if (
      navigation.username
      || navigation.password
      || (navigation.protocol !== 'http:' && navigation.protocol !== 'https:')
    ) {
      return null;
    }

    const target = ENTERPRISE_WEB_SESSION_TARGETS.find(candidate => (
      candidate.isDevelopment === isDevelopment
      && navigation.origin === candidate.origin
      && (
        !candidate.pathPrefix
        || navigation.pathname === candidate.pathPrefix
        || navigation.pathname.startsWith(`${candidate.pathPrefix}/`)
      )
    ));
    return target ? { navigation, target } : null;
  } catch {
    return null;
  }
};

export const isEnterpriseWebSessionNavigation = (
  navigationUrl: string,
  isDevelopment: boolean,
): boolean => resolveEnterpriseWebSessionNavigationTarget(navigationUrl, isDevelopment) !== null;

export const resolveEnterpriseWebSessionTarget = (
  navigationUrl: string,
  isDevelopment: boolean,
): EnterpriseWebSessionReference | null => {
  const resolved = resolveEnterpriseWebSessionNavigationTarget(navigationUrl, isDevelopment);
  if (!resolved || resolved.navigation.searchParams.has('handoff')) {
    return null;
  }
  const relativePath = resolved.target.pathPrefix
    ? resolved.navigation.pathname.slice(resolved.target.pathPrefix.length) || '/'
    : resolved.navigation.pathname;
  if ([...NON_AUTHENTICATED_PORTAL_PATHS].some(path => (
    relativePath === path || relativePath.startsWith(`${path}/`)
  ))) {
    return null;
  }
  return publicReference(resolved.target);
};

export const getEnterpriseWebSessionOrigins = (isDevelopment: boolean): string[] => (
  [...new Set(
    ENTERPRISE_WEB_SESSION_TARGETS
      .filter(target => target.isDevelopment === isDevelopment)
      .map(target => target.origin),
  )]
);

interface ParsedEnterpriseContext {
  user: EnterpriseDesktopUser;
  csrfToken: string;
}

const parseEnterpriseContext = (
  value: unknown,
  expectedEntryType: EnterpriseWebSessionEntryType,
): ParsedEnterpriseContext | null => {
  const context = asRecord(value);
  const identity = asRecord(context?.identity);
  const enterprise = asRecord(context?.enterprise);
  const membership = asRecord(context?.membership);
  const managementAccess = asRecord(context?.management_access);
  if (!context || !identity || !enterprise || !membership || !managementAccess) return null;

  const entryType = readNonEmptyString(context.entry_type);
  const csrfToken = readNonEmptyString(context.csrf_token);
  const identityAccountId = readNonEmptyString(identity.identity_account_id);
  const globalUserId = readNonEmptyString(identity.global_user_id);
  const enterpriseId = readNonEmptyString(enterprise.tenant_id);
  const enterpriseName = readNonEmptyString(enterprise.display_name);
  const membershipId = readNonEmptyString(membership.membership_id);
  const role = readNonEmptyString(membership.role);
  if (
    entryType !== expectedEntryType
    || !csrfToken
    || csrfToken.length < 32
    || csrfToken.length > 512
    || !identityAccountId
    || !globalUserId
    || !enterpriseId
    || !enterpriseName
    || !membershipId
    || !role
    || identity.status !== 'active'
    || enterprise.status !== 'active'
    || membership.status !== 'active'
  ) {
    return null;
  }
  if (
    expectedEntryType === EnterpriseWebSessionEntryType.Admin
      ? managementAccess.state !== 'granted'
      : managementAccess.state !== 'none'
  ) {
    return null;
  }

  return {
    csrfToken,
    user: {
      yid: globalUserId,
      userId: globalUserId,
      id: identityAccountId,
      nickname: enterpriseName,
      role,
      status: 1,
      entryType: expectedEntryType,
      enterpriseId,
      enterpriseName,
      membershipId,
    },
  };
};

type EnterpriseContextLoadResult =
  | {
      status: typeof EnterpriseWebSessionValidationStatus.Authenticated;
      context: ParsedEnterpriseContext;
    }
  | {
      status: typeof EnterpriseWebSessionValidationStatus.Expired
        | typeof EnterpriseWebSessionValidationStatus.Rejected
        | typeof EnterpriseWebSessionValidationStatus.TemporarilyUnavailable;
    };

const loadEnterpriseContext = async (
  options: ValidateEnterpriseWebSessionOptions,
): Promise<EnterpriseContextLoadResult> => {
  if (!isEnterpriseWebSessionReference(options.reference, options.isDevelopment)) {
    return { status: EnterpriseWebSessionValidationStatus.Rejected };
  }

  try {
    const response = await options.fetch(options.reference.profileUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      return { status: EnterpriseWebSessionValidationStatus.Expired };
    }
    if (!response.ok) {
      return { status: EnterpriseWebSessionValidationStatus.TemporarilyUnavailable };
    }
    const context = parseEnterpriseContext(
      await response.json().catch((): null => null),
      options.reference.entryType,
    );
    return context
      ? { status: EnterpriseWebSessionValidationStatus.Authenticated, context }
      : { status: EnterpriseWebSessionValidationStatus.Rejected };
  } catch {
    return { status: EnterpriseWebSessionValidationStatus.TemporarilyUnavailable };
  }
};

export const validateEnterpriseWebSession = async (
  options: ValidateEnterpriseWebSessionOptions,
): Promise<EnterpriseWebSessionValidationResult> => {
  const result = await loadEnterpriseContext(options);
  return result.status === EnterpriseWebSessionValidationStatus.Authenticated
    ? { status: result.status, user: result.context.user }
    : result;
};

export const recoverEnterpriseWebSession = async (
  options: RecoverEnterpriseWebSessionOptions,
): Promise<EnterpriseWebSessionRecoveryResult> => {
  const reference = resolveEnterpriseWebSessionTarget(
    options.navigationUrl,
    options.isDevelopment,
  );
  if (!reference) {
    return { status: EnterpriseWebSessionValidationStatus.Ignored };
  }
  const result = await validateEnterpriseWebSession({
    reference,
    fetch: options.fetch,
    isDevelopment: options.isDevelopment,
  });
  return result.status === EnterpriseWebSessionValidationStatus.Authenticated
    ? { ...result, reference }
    : result;
};

export const logoutEnterpriseWebSession = async (
  options: ValidateEnterpriseWebSessionOptions,
): Promise<boolean> => {
  const contextResult = await loadEnterpriseContext(options);
  if (contextResult.status === EnterpriseWebSessionValidationStatus.Expired) return true;
  if (contextResult.status !== EnterpriseWebSessionValidationStatus.Authenticated) return false;

  try {
    const response = await options.fetch(options.reference.logoutUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': contextResult.context.csrfToken,
      },
      body: '{}',
    });
    return response.ok;
  } catch {
    return false;
  }
};
