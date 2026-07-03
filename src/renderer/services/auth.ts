import { ProviderName } from '@shared/providers';

import { store } from '../store';
import {
  setAuthLoading,
  setLoggedIn,
  setLoggedOut,
  setProfileSummary,
  updateQuota,
  type UserProfile,
  type UserQuota,
} from '../store/slices/authSlice';
import type { Model } from '../store/slices/modelSlice';
import {
  clearServerModels,
  setServerModels,
} from '../store/slices/modelSlice';

interface AuthStateRefreshResult {
  isLoggedIn: boolean;
  user: UserProfile | null;
  quota: UserQuota | null;
}

const MOCK_AUTH_USER: UserProfile = {
  yid: 'mock-lzclaw-user',
  nickname: '模拟用户',
  avatarUrl: null,
  userId: 'mock-lzclaw-user',
  id: 0,
  status: 1,
};

const MOCK_AUTH_QUOTA: UserQuota = {
  planName: '模拟套餐',
  subscriptionStatus: 'active',
  creditsLimit: 999_999,
  creditsUsed: 0,
  creditsRemaining: 999_999,
  hasPaidCredits: true,
};

export interface PricingCatalogTextModel {
  modelId?: string;
  modelName?: string;
  provider?: string;
  providerLabel?: string;
  description?: string;
  supportsImage?: boolean;
  supportsThinking?: boolean;
  contextWindow?: number | null;
  costMultiplier?: number;
}

export interface PricingCatalogResponse {
  textModels?: PricingCatalogTextModel[];
  imageModels?: unknown[];
  videoModels?: unknown[];
}

const readString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const readPositiveNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined
);

export function mapPricingCatalogTextModelsToServerModels(
  textModels: PricingCatalogTextModel[],
): Model[] {
  return textModels.flatMap((model): Model[] => {
    const modelId = readString(model.modelId);
    if (!modelId) return [];

    const modelName = readString(model.modelName) || modelId;
    const provider = readString(model.providerLabel)
      || readString(model.provider)
      || 'LobsterAI';
    const contextWindow = readPositiveNumber(model.contextWindow);
    const costMultiplier = readPositiveNumber(model.costMultiplier);

    return [{
      id: modelId,
      name: modelName,
      provider,
      providerKey: ProviderName.LobsteraiServer,
      isServerModel: true,
      supportsImage: model.supportsImage === true,
      supportsThinking: model.supportsThinking === true,
      description: readString(model.description) || undefined,
      costMultiplier,
      contextWindow,
      accessible: false,
    }];
  });
}

export function mapPricingCatalogToPublicServerModels(
  catalog: PricingCatalogResponse,
): Model[] {
  return mapPricingCatalogTextModelsToServerModels(
    Array.isArray(catalog.textModels) ? catalog.textModels : [],
  );
}

class AuthService {
  private unsubCallback: (() => void) | null = null;
  private unsubQuotaChanged: (() => void) | null = null;
  private unsubWindowState: (() => void) | null = null;
  private lastRefreshTime = 0;
  private isMockLoggedIn = false;

  /**
   * Initialize: try to restore login state from persisted token.
   */
  async init() {
    // Clean up any existing listeners to prevent stacking on repeated init()
    this.destroy();

    store.dispatch(setAuthLoading(true));

    // Listen for OAuth callback from protocol handler
    this.unsubCallback = window.electron.auth.onCallback(async ({ code }) => {
      await this.handleCallback(code);
    });

    try {
      const pendingCode = await window.electron.auth.getPendingCallback();
      let handledPendingCode = false;
      if (pendingCode) {
        handledPendingCode = await this.handleCallback(pendingCode);
      }
      if (!handledPendingCode) {
        await this.refreshAuthState({ clearOnFailure: true });
      }
    } catch {
      store.dispatch(setLoggedOut());
      store.dispatch(clearServerModels());
      await this.loadPublicPricingCatalogModels();
    }

    // Listen for quota changes (e.g. after cowork session using server model)
    this.unsubQuotaChanged = window.electron.auth.onQuotaChanged(() => {
      this.refreshQuota();
      void this.fetchProfileSummary();
      this.loadServerModels();
    });

    // Refresh quota and models when Electron window gains focus — user may have purchased on portal
    this.unsubWindowState = window.electron.window.onStateChanged((state) => {
      if (state.isFocused && store.getState().auth.isLoggedIn && !this.isMockLoggedIn) {
        const now = Date.now();
        if (now - this.lastRefreshTime > 30_000) {
          this.lastRefreshTime = now;
          this.refreshQuota();
          void this.fetchProfileSummary();
          this.loadServerModels();
        }
      }
    });
  }

  /**
   * The unauthenticated app gate renders the password login form directly.
   */
  async login() {
    if (!store.getState().auth.isLoggedIn) {
      store.dispatch(setLoggedOut());
    }
  }

  async loginWithPassword(account: string, password: string): Promise<AuthStateRefreshResult> {
    this.isMockLoggedIn = false;
    const result = await window.electron.auth.passwordLogin({
      account: account.trim(),
      password,
    });
    if (!result.success || !result.user || !result.quota) {
      throw new Error(result.error || '登录失败');
    }

    store.dispatch(setLoggedIn({ user: result.user, quota: result.quota }));
    await this.loadServerModels();
    void this.fetchProfileSummary();
    void this.refreshQuota();
    return {
      isLoggedIn: true,
      user: result.user,
      quota: result.quota,
    };
  }

  async loginWithMockUser(): Promise<AuthStateRefreshResult> {
    this.isMockLoggedIn = true;
    store.dispatch(clearServerModels());
    store.dispatch(setLoggedIn({ user: MOCK_AUTH_USER, quota: MOCK_AUTH_QUOTA }));
    store.dispatch(setProfileSummary({
      id: MOCK_AUTH_USER.id ?? 0,
      nickname: MOCK_AUTH_USER.nickname,
      avatarUrl: MOCK_AUTH_USER.avatarUrl,
      totalCreditsRemaining: MOCK_AUTH_QUOTA.creditsRemaining,
      creditItems: [{
        type: 'subscription',
        label: '模拟额度',
        labelEn: 'Mock credits',
        creditsRemaining: MOCK_AUTH_QUOTA.creditsRemaining,
        expiresAt: null,
      }],
    }));
    return {
      isLoggedIn: true,
      user: MOCK_AUTH_USER,
      quota: MOCK_AUTH_QUOTA,
    };
  }

  /**
   * Handle OAuth callback with auth code.
   */
  async handleCallback(code: string): Promise<boolean> {
    try {
      const result = await window.electron.auth.exchange(code);
      if (result.success) {
        this.isMockLoggedIn = false;
        store.dispatch(setLoggedIn({ user: result.user, quota: result.quota }));
        await this.loadServerModels();
        void this.fetchProfileSummary();
        this.refreshQuota();
        return true;
      }
    } catch (e) {
      console.error('Auth callback failed:', e);
    }
    return false;
  }

  /**
   * Refresh the full auth snapshot from persisted tokens.
   */
  async refreshAuthState(
    options: { clearOnFailure?: boolean } = {},
  ): Promise<AuthStateRefreshResult> {
    try {
      const result = await window.electron.auth.getUser();
      if (result.success && result.user) {
        this.isMockLoggedIn = false;
        store.dispatch(setLoggedIn({ user: result.user, quota: result.quota }));
        await this.loadServerModels();
        void this.fetchProfileSummary();
        return { isLoggedIn: true, user: result.user, quota: result.quota ?? null };
      }
    } catch {
      // handled below
    }

    if (options.clearOnFailure) {
      this.isMockLoggedIn = false;
      store.dispatch(setLoggedOut());
      store.dispatch(clearServerModels());
      await this.loadPublicPricingCatalogModels();
    }

    const current = store.getState().auth;
    return {
      isLoggedIn: current.isLoggedIn,
      user: current.user,
      quota: current.quota,
    };
  }

  /**
   * Logout.
   */
  async logout() {
    this.isMockLoggedIn = false;
    await window.electron.auth.logout();
    store.dispatch(setLoggedOut());
    store.dispatch(clearServerModels());
    await this.loadPublicPricingCatalogModels();
  }

  /**
   * Refresh quota information.
   */
  async refreshQuota() {
    if (this.isMockLoggedIn) return;
    try {
      const result = await window.electron.auth.getQuota();
      if (result.success) {
        store.dispatch(updateQuota(result.quota));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Fetch profile summary (credits breakdown).
   */
  async fetchProfileSummary() {
    if (this.isMockLoggedIn) return;
    try {
      const result = await window.electron.auth.getProfileSummary();
      if (result.success && result.data) {
        store.dispatch(setProfileSummary(result.data));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Get current access token (for proxy API calls).
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await window.electron.auth.getAccessToken();
    } catch {
      return null;
    }
  }

  destroy() {
    this.unsubCallback?.();
    this.unsubCallback = null;
    this.unsubQuotaChanged?.();
    this.unsubQuotaChanged = null;
    this.unsubWindowState?.();
    this.unsubWindowState = null;
  }

  /**
   * Load available models from server and dispatch to store.
   */
  private async loadServerModels() {
    if (this.isMockLoggedIn) return;
    try {
      const modelsResult = await window.electron.auth.getModels();
      if (modelsResult.success && modelsResult.models) {
        const serverModels: Model[] = modelsResult.models.map((m: { modelId: string; modelName: string; provider: string; apiFormat: string; supportsImage?: boolean; supportsThinking?: boolean; contextWindow?: number; explicitContextCache?: boolean; costMultiplier?: number; description?: string; accessible?: boolean; restrictionHint?: string }) => ({
          id: m.modelId,
          name: m.modelName,
          provider: m.provider,
          providerKey: 'lobsterai-server',
          isServerModel: true,
          serverApiFormat: m.apiFormat,
          supportsImage: m.supportsImage ?? false,
          supportsThinking: m.supportsThinking ?? false,
          contextWindow: m.contextWindow,
          explicitContextCache: m.explicitContextCache ?? false,
          description: m.description,
          costMultiplier: m.costMultiplier,
          accessible: m.accessible ?? true,
          restrictionHint: m.restrictionHint ?? undefined,
        }));
        store.dispatch(setServerModels(serverModels));
        console.debug(`[Auth] loaded ${serverModels.length} server model(s) into renderer state`);
      } else {
        console.debug('[Auth] server model load returned no models');
      }
    } catch (error) {
      console.warn('[Auth] failed to load server models:', error);
    }
  }

  /**
   * Load public pricing catalog models for unauthenticated read-only display.
   */
  private async loadPublicPricingCatalogModels() {
    try {
      const catalogResult = await window.electron.auth.getPricingCatalog();
      if (!catalogResult.success || !catalogResult.textModels) {
        return;
      }
      const serverModels = mapPricingCatalogToPublicServerModels({
        textModels: catalogResult.textModels,
      });
      store.dispatch(setServerModels(serverModels));
    } catch {
      // ignore — public catalog is optional
    }
  }
}

export const authService = new AuthService();
