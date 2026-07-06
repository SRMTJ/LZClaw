export const AuthIpcChannel = {
  Callback: 'auth:callback',
  CancelLogin: 'auth:cancelLogin',
  GetPricingCatalog: 'auth:getPricingCatalog',
  GetPendingCallback: 'auth:getPendingCallback',
  GetWorkspaces: 'auth:getWorkspaces',
  PasswordLogin: 'auth:passwordLogin',
  PrepareLogin: 'auth:prepareLogin',
  SessionInvalidated: 'auth:sessionInvalidated',
  SwitchWorkspace: 'auth:switchWorkspace',
} as const;

export type AuthIpcChannel = typeof AuthIpcChannel[keyof typeof AuthIpcChannel];

export const AuthLoginWebviewPartition = 'persist:lzclaw-auth-login';

export const AuthSubscriptionStatus = {
  Active: 'active',
  Free: 'free',
} as const;

export type AuthSubscriptionStatus = typeof AuthSubscriptionStatus[keyof typeof AuthSubscriptionStatus];
