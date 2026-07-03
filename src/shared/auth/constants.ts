export const AuthIpcChannel = {
  Callback: 'auth:callback',
  CancelLogin: 'auth:cancelLogin',
  GetPricingCatalog: 'auth:getPricingCatalog',
  GetPendingCallback: 'auth:getPendingCallback',
  PasswordLogin: 'auth:passwordLogin',
  PrepareLogin: 'auth:prepareLogin',
} as const;

export type AuthIpcChannel = typeof AuthIpcChannel[keyof typeof AuthIpcChannel];

export const AuthLoginWebviewPartition = 'persist:lzclaw-auth-login';

export const AuthSubscriptionStatus = {
  Active: 'active',
  Free: 'free',
} as const;

export type AuthSubscriptionStatus = typeof AuthSubscriptionStatus[keyof typeof AuthSubscriptionStatus];
