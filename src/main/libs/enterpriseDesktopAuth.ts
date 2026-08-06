import {
  EnterpriseDesktopAuthorizationCodePrefix,
  resolveAuthLoginPageUrl,
} from '../../shared/auth/constants';
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
  fetch: (url: string, options: RequestInit) => Promise<Response>;
  isDevelopment: boolean;
}

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
        body: JSON.stringify({ authCode: options.authCode }),
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
    };
  } catch {
    return { status: EnterpriseDesktopExchangeStatus.Unavailable };
  }
};
