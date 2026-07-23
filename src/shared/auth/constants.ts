export const AuthIpcChannel = {
  Callback: 'auth:callback',
  LoginInApp: 'auth:loginInApp',
  UpdateLoginInAppBounds: 'auth:updateLoginInAppBounds',
  CloseLoginInApp: 'auth:closeLoginInApp',
  GetPricingCatalog: 'auth:getPricingCatalog',
  GetPendingCallback: 'auth:getPendingCallback',
} as const;

export type AuthIpcChannel = typeof AuthIpcChannel[keyof typeof AuthIpcChannel];

export interface AuthLoginInAppBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AuthLoginInAppRequest {
  loginUrl?: string;
  bounds: AuthLoginInAppBounds;
}

export const AuthSubscriptionStatus = {
  Active: 'active',
  Free: 'free',
} as const;

export type AuthSubscriptionStatus = typeof AuthSubscriptionStatus[keyof typeof AuthSubscriptionStatus];
