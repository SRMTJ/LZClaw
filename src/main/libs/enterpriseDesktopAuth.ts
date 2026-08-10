import {
  EnterpriseDesktopAuthorizationCodePrefix,
  resolveAuthLoginPageUrl,
} from '../../shared/auth/constants';
import {
  type EnterpriseModelCredential,
  isEnterpriseModelCredential,
} from '../../shared/modelCredential/constants';
import {
  EnterpriseWebSessionEntryType,
  type EnterpriseWebSessionEntryType as EnterpriseWebSessionEntryTypeValue,
} from './enterpriseWebSessionAuth';

export const EnterpriseDesktopExchangeStatus = {
  Exchanged: 'exchanged',
  Rejected: 'rejected',
  Unavailable: 'unavailable',
  Unsupported: 'unsupported',
} as const;

export type EnterpriseDesktopExchangeStatus =
  typeof EnterpriseDesktopExchangeStatus[keyof typeof EnterpriseDesktopExchangeStatus];

export const EnterpriseDesktopExchangePath = '/auth/workstation-desktop-exchange';

export type EnterpriseDesktopExchangeResult =
  | {
      status: typeof EnterpriseDesktopExchangeStatus.Exchanged;
      entryType: EnterpriseWebSessionEntryTypeValue;
      modelCredential?: EnterpriseModelCredential;
    }
  | {
      status: typeof EnterpriseDesktopExchangeStatus.Rejected;
      httpStatus: number;
    }
  | { status: typeof EnterpriseDesktopExchangeStatus.Unavailable }
  | { status: typeof EnterpriseDesktopExchangeStatus.Unsupported };

export const shouldUseLegacyDesktopAuthorizationExchange = (
  authCode: string,
  enterpriseResult: EnterpriseDesktopExchangeResult,
): boolean => (
  !authCode.startsWith(EnterpriseDesktopAuthorizationCodePrefix)
  && enterpriseResult.status === EnterpriseDesktopExchangeStatus.Unsupported
);

interface EnterpriseDesktopExchangeOptions {
  authCode: string;
  codeVerifier?: string;
  fetch: (url: string, options: RequestInit) => Promise<Response>;
  isDevelopment: boolean;
}

interface EnterpriseDesktopVerifierStoreOptions {
  now?: () => number;
  ttlMs?: number;
}

interface EnterpriseDesktopVerifierEntry {
  codeVerifier: string;
  expiresAt: number;
}

const ENTERPRISE_DESKTOP_VERIFIER_TTL_MS = 15 * 60 * 1000;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
);

const validOpaqueCode = (value: string): boolean => {
  if (
    value.trim() !== value
    || value.length < 36
    || value.length > 256
  ) return false;
  return ![...value].some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
};

export const isValidEnterpriseDesktopCodeVerifier = (value: string): boolean => (
  value.length >= 43
  && value.length <= 128
  && /^[A-Za-z0-9._~-]+$/.test(value)
);

export class EnterpriseDesktopVerifierStore {
  private readonly entries = new Map<string, EnterpriseDesktopVerifierEntry>();
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options: EnterpriseDesktopVerifierStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? ENTERPRISE_DESKTOP_VERIFIER_TTL_MS;
  }

  bind(authCode: string, codeVerifier: string): boolean {
    this.pruneExpired();
    if (
      !authCode.startsWith(EnterpriseDesktopAuthorizationCodePrefix)
      || !validOpaqueCode(authCode)
      || !isValidEnterpriseDesktopCodeVerifier(codeVerifier)
    ) {
      return false;
    }
    this.entries.set(authCode, {
      codeVerifier,
      expiresAt: this.now() + this.ttlMs,
    });
    return true;
  }

  consume(authCode: string): string | null {
    const entry = this.entries.get(authCode);
    this.entries.delete(authCode);
    if (!entry || entry.expiresAt <= this.now()) {
      return null;
    }
    return entry.codeVerifier;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [authCode, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(authCode);
      }
    }
  }
}

export const resolveEnterpriseDesktopExchangeUrl = (isDevelopment: boolean): string => (
  new URL(
    EnterpriseDesktopExchangePath,
    resolveAuthLoginPageUrl(isDevelopment),
  ).toString()
);

export const exchangeEnterpriseDesktopAuthorization = async (
  options: EnterpriseDesktopExchangeOptions,
): Promise<EnterpriseDesktopExchangeResult> => {
  if (!options.authCode.startsWith(EnterpriseDesktopAuthorizationCodePrefix)) {
    return { status: EnterpriseDesktopExchangeStatus.Unsupported };
  }
  if (!validOpaqueCode(options.authCode)) {
    return {
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 400,
    };
  }
  if (!options.codeVerifier || !isValidEnterpriseDesktopCodeVerifier(options.codeVerifier)) {
    return {
      status: EnterpriseDesktopExchangeStatus.Rejected,
      httpStatus: 400,
    };
  }
  try {
    const response = await options.fetch(
      resolveEnterpriseDesktopExchangeUrl(options.isDevelopment),
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authCode: options.authCode,
          codeVerifier: options.codeVerifier,
        }),
      },
    );
    if (!response.ok) {
      return {
        status: EnterpriseDesktopExchangeStatus.Rejected,
        httpStatus: response.status,
      };
    }
    const body = asRecord(await response.json().catch((): null => null));
    const data = asRecord(body?.data);
    const entryType = data?.entryType;
    const rawModelCredential = data?.modelCredential;
    if (
      body?.code !== 0
      || (entryType !== EnterpriseWebSessionEntryType.Admin
        && entryType !== EnterpriseWebSessionEntryType.Employee)
    ) {
      return {
        status: EnterpriseDesktopExchangeStatus.Rejected,
        httpStatus: response.status,
      };
    }
    return {
      status: EnterpriseDesktopExchangeStatus.Exchanged,
      entryType,
      ...(isEnterpriseModelCredential(rawModelCredential, options.isDevelopment)
        ? { modelCredential: rawModelCredential }
        : {}),
    };
  } catch {
    return { status: EnterpriseDesktopExchangeStatus.Unavailable };
  }
};
