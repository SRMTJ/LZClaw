import {
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo,useRef, useState } from 'react';
import { useDispatch,useSelector } from 'react-redux';

import {
  APP_UPDATE_HEARTBEAT_INTERVAL_MS,
  APP_UPDATE_POLL_INTERVAL_MS,
  type AppUpdateInfo,
  type AppUpdateRuntimeState,
  AppUpdateStatus,
  isManualDownloadUrl,
} from '../shared/appUpdate/constants';
import { OnboardingState } from '../shared/onboarding/constants';
import { ProviderAuthType, ProviderName, ProviderRegistry } from '../shared/providers';
import BusinessCenterView from './components/businessCenter/BusinessCenterView';
import { CoworkView } from './components/cowork';
import { CoworkShortcutDirection, CoworkUiEvent } from './components/cowork/constants';
import CoworkPermissionModal from './components/cowork/CoworkPermissionModal';
import CoworkQuestionWizard from './components/cowork/CoworkQuestionWizard';
import EngineFailureOverlay from './components/cowork/EngineFailureOverlay';
import EngineStartupOverlay from './components/cowork/EngineStartupOverlay';
import KitsView from './components/kits/KitsView';
import { McpView } from './components/mcp';
import OnboardingOrbitScene from './components/onboarding/OnboardingOrbitScene';
import PersonalCenter from './components/PersonalCenter';
import PrivacyDialog from './components/PrivacyDialog';
import { ScheduledTasksView } from './components/scheduledTasks';
import Settings, { type SettingsOpenOptions } from './components/Settings';
import Sidebar from './components/Sidebar';
import { SkillsView } from './components/skills';
import Toast from './components/Toast';
import AppUpdateBadge from './components/update/AppUpdateBadge';
import AppUpdateCard from './components/update/AppUpdateCard';
import AppUpdateModal from './components/update/AppUpdateModal';
import WelcomeDialog from './components/WelcomeDialog';
import WindowsAppTitleBar from './components/window/WindowsAppTitleBar';
import WindowTitleBar from './components/window/WindowTitleBar';
import { defaultConfig, getProviderDisplayName, ShortcutAction } from './config';
import type { ApiConfig } from './services/api';
import { apiService } from './services/api';
import { authService } from './services/auth';
import { configService } from './services/config';
import { coworkService } from './services/cowork';
import { i18nService } from './services/i18n';
import { LogReporterAction, reportYdAnalyzer } from './services/logReporter';
import { scheduledTaskService } from './services/scheduledTask';
import { matchesShortcut } from './services/shortcuts';
import { themeService } from './services/theme';
import { applyTypographyPreferences } from './services/typography';
import { RootState, store } from './store';
import {
  selectCurrentSessionId,
  selectFirstCurrentSessionPendingPermission,
  selectPendingPermissions,
} from './store/selectors/coworkSelectors';
import { setDraftCollaborationMode, setDraftKitIds, setDraftPrompt } from './store/slices/coworkSlice';
import { setActiveKitIds } from './store/slices/kitSlice';
import { setAvailableModels, setDefaultSelectedModel } from './store/slices/modelSlice';
import { clearSelection } from './store/slices/quickActionSlice';
import { CoworkCollaborationMode, type CoworkPermissionResult } from './types/cowork';

const AGENT_TASK_SLOT_SHORTCUT_ACTIONS = [
  ShortcutAction.OpenAgentTask1,
  ShortcutAction.OpenAgentTask2,
  ShortcutAction.OpenAgentTask3,
  ShortcutAction.OpenAgentTask4,
  ShortcutAction.OpenAgentTask5,
  ShortcutAction.OpenAgentTask6,
  ShortcutAction.OpenAgentTask7,
  ShortcutAction.OpenAgentTask8,
  ShortcutAction.OpenAgentTask9,
] as const;

const SETTINGS_TAB_SHORTCUT_ACTIONS: Array<{
  action: ShortcutAction;
  initialTab: NonNullable<SettingsOpenOptions['initialTab']>;
}> = [
  { action: ShortcutAction.OpenSettingsGeneral, initialTab: 'general' },
  { action: ShortcutAction.OpenSettingsAppearance, initialTab: 'appearance' },
  { action: ShortcutAction.OpenSettingsAgentEngine, initialTab: 'coworkAgentEngine' },
  { action: ShortcutAction.OpenSettingsModel, initialTab: 'model' },
  { action: ShortcutAction.OpenSettingsIm, initialTab: 'im' },
  { action: ShortcutAction.OpenSettingsBrowser, initialTab: 'browserWebAccess' },
  { action: ShortcutAction.OpenSettingsEmail, initialTab: 'email' },
  { action: ShortcutAction.OpenSettingsMemory, initialTab: 'coworkMemory' },
  { action: ShortcutAction.OpenSettingsDreaming, initialTab: 'coworkDreaming' },
  { action: ShortcutAction.OpenSettingsPlugins, initialTab: 'plugins' },
  { action: ShortcutAction.OpenSettingsShortcuts, initialTab: 'shortcuts' },
  { action: ShortcutAction.OpenSettingsAbout, initialTab: 'about' },
];

type MainView = 'cowork' | 'skills' | 'scheduledTasks' | 'kits' | 'mcp' | 'businessCenter';

/** Used for config + i18n init; longer on Windows where main-process IPC can stall during cold start. */
const INIT_STEP_TIMEOUT_MS_WINDOWS = 24_000;
const INIT_STEP_TIMEOUT_MS_DEFAULT = 16_000;
const SCHEDULED_TASK_INIT_TIMEOUT_MS = 15_000;

type EnterpriseConfig = {
  ui?: Record<string, 'hide' | 'disable' | 'readonly'>;
  onboarding?: {
    enabled?: boolean;
  };
  disableUpdate?: boolean;
} | null;

const isOnboardingEnabledValue = (value: unknown): boolean => {
  return value === true || value === 'true' || value === 1 || value === '1';
};

const resolveOnboardingEnabled = (enterpriseConfig: EnterpriseConfig, storedValue: unknown): boolean => {
  if (typeof enterpriseConfig?.onboarding?.enabled === 'boolean') {
    return enterpriseConfig.onboarding.enabled;
  }

  return isOnboardingEnabledValue(storedValue);
};

const LoginRequiredScreen: React.FC<{
  onPasswordLogin: (account: string, password: string) => Promise<void>;
  onSkipLogin: () => void;
  hasImmersiveTitleBar?: boolean;
}> = ({ onPasswordLogin, onSkipLogin, hasImmersiveTitleBar = false }) => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submittingMode, setSubmittingMode] = useState<'password' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = submittingMode !== null;

  const handlePasswordLogin = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAccount = account.trim();
    if (!trimmedAccount) {
      setErrorMessage('请输入账号');
      return;
    }
    if (!password) {
      setErrorMessage('请输入密码');
      return;
    }
    setSubmittingMode('password');
    setErrorMessage(null);
    void onPasswordLogin(trimmedAccount, password)
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : '登录失败，请稍后重试。');
      })
      .finally(() => {
        setSubmittingMode(null);
      });
  }, [account, onPasswordLogin, password]);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#020714] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_42%,rgba(8,145,178,0.24),transparent_34%),radial-gradient(circle_at_76%_54%,rgba(239,68,56,0.12),transparent_30%),linear-gradient(180deg,#010612_0%,#031326_50%,#01040c_100%)]" />
      <OnboardingOrbitScene activeStep={1} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(1,7,19,0.24)_0%,transparent_38%,rgba(1,7,19,0.68)_74%,rgba(1,7,19,0.9)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent,rgba(1,5,13,0.9))]" />

      <div
        className={`relative z-10 flex min-h-0 w-full flex-1 overflow-y-auto px-4 pb-5 sm:px-8 sm:pb-8 ${
          hasImmersiveTitleBar ? 'pt-12 sm:pt-14' : 'pt-5 sm:pt-8'
        }`}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
          <section className="hidden max-w-[390px] self-end pb-16 lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#4bdcff]/18 bg-[#02172b]/42 px-4 py-2 text-xs font-bold uppercase text-[#8cecff] shadow-[0_0_32px_rgba(34,211,238,0.12)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5ce7ff] shadow-[0_0_16px_rgba(92,231,255,0.9)]" />
              LZClaw 工作站
            </div>
            <img
              src="logo.png"
              alt="LZClaw"
              width={64}
              height={64}
              className="mt-8 h-14 w-14 rounded-lg shadow-[0_18px_52px_rgba(239,68,56,0.36)]"
              draggable={false}
            />
            <h1 className="mt-7 text-[42px] font-bold leading-tight text-white">
              企业 AI 工作台
            </h1>
            <p className="mt-4 text-sm font-medium leading-6 text-[#b9cce2]">
              使用企业账号进入默认工作区，模型和额度随账号同步。
            </p>
          </section>

          <section className="remove-app-drag relative mx-auto w-full max-w-[430px] rounded-lg border border-[#45dbff]/28 bg-[#04172a]/64 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.48),0_0_0_1px_rgba(122,236,255,0.06)] backdrop-blur-xl sm:p-6">
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#5ce7ff]/70 to-transparent" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#5ce7ff]/18 bg-[#062c46]/82 text-[#baf6ff] shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <UserCircleIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#5ce7ff]">企业账号</div>
                  <div className="mt-1 text-sm font-semibold text-[#8ba4bb]">LZClaw 企业工作站</div>
                </div>
              </div>
              <BuildingOffice2Icon className="h-7 w-7 text-[#5ce7ff]/42" />
            </div>

            <h1 className="mt-6 text-[28px] font-bold leading-tight text-white sm:text-[32px]">企业账号登录</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-[#c6d8ea]">
              登录后进入默认工作区。
            </p>

            {errorMessage && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/12 px-3 py-2 text-sm leading-5 text-red-100">
                <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form className="mt-5 flex flex-col gap-4" onSubmit={handlePasswordLogin}>
              <label className="flex flex-col gap-1.5 text-sm text-[#eaf7ff]">
                <span className="font-semibold">账号</span>
                <div className="relative">
                  <UserCircleIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ba4bb]" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={account}
                    onChange={(event) => setAccount(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="手机号 / 用户名 / 邮箱"
                    className="h-11 w-full rounded-lg border border-[#69e6ff]/18 bg-[#020b16]/70 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-[#6d8197] focus:border-[#5ce7ff]/72 focus:bg-[#03111f] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-[#eaf7ff]">
                <span className="font-semibold">密码</span>
                <div className="relative">
                  <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ba4bb]" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="请输入企业账号密码"
                    className="h-11 w-full rounded-lg border border-[#69e6ff]/18 bg-[#020b16]/70 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-[#6d8197] focus:border-[#5ce7ff]/72 focus:bg-[#03111f] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex h-[52px] items-center justify-center gap-3 rounded-full bg-[#ef4438] px-5 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(239,68,56,0.36)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ff513f] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {submittingMode === 'password' && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                {submittingMode === 'password' ? '正在登录' : '登录'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onSkipLogin}
                title={i18nService.t('authSkipLoginHint')}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-[#9fb8cc] transition-colors hover:bg-[#0a2940]/66 hover:text-[#dff9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ce7ff]/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {i18nService.t('authSkipLogin')}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#69e6ff]/18 bg-[#03111f]/58 px-4 py-3 text-[#cde8f5] shadow-[inset_0_1px_0_rgba(125,233,255,0.08)]">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#083550] text-[#a8f1ff]">
                <CheckCircleIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold leading-5">
                仅保存业务会话，不保存身份 Token。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showPersonalCenter, setShowPersonalCenter] = useState(false);
  const [settingsOptions, setSettingsOptions] = useState<SettingsOpenOptions & { requestId: number }>({ requestId: 0 });
  const [mainView, setMainView] = useState<MainView>('cowork');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [, forceLanguageRefresh] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(244);
  const [appUpdateState, setAppUpdateState] = useState<AppUpdateRuntimeState>({
    status: AppUpdateStatus.Idle,
    source: null,
    info: null,
    progress: null,
    readyFilePath: null,
    readyFileHash: null,
    errorMessage: null,
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdateCardExpanded, setIsUpdateCardExpanded] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState<boolean | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasSkippedLogin, setHasSkippedLogin] = useState(false);
  const [enterpriseConfig, setEnterpriseConfig] = useState<EnterpriseConfig>(null);
  const toastTimerRef = useRef<number | null>(null);
  const hasInitialized = useRef(false);
  const hasReportedAppStartedRef = useRef(false);
  const previousUpdateStatusRef = useRef<AppUpdateRuntimeState['status']>(AppUpdateStatus.Idle);
  const shouldInstallReadyUpdateRef = useRef(false);
  const dispatch = useDispatch();
  const defaultSelectedModel = useSelector((state: RootState) => state.model.defaultSelectedModel);
  const currentSessionId = useSelector(selectCurrentSessionId);
  const pendingPermission = useSelector(selectFirstCurrentSessionPendingPermission);
  const pendingPermissions = useSelector(selectPendingPermissions);
  const authIsLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const authIsLoading = useSelector((state: RootState) => state.auth.isLoading);
  const authUser = useSelector((state: RootState) => state.auth.user);
  const authWorkspace = useSelector((state: RootState) => state.auth.workspace);
  const isWindows = window.electron.platform === 'win32';
  const canAccessBusinessCenter = authWorkspace?.role === 'owner' || authWorkspace?.role === 'admin';
  const [minimizedPermissionIds, setMinimizedPermissionIds] = useState<string[]>([]);
  const isPendingPermissionMinimized = pendingPermission
    ? minimizedPermissionIds.includes(pendingPermission.requestId)
    : false;
  const isPermissionModalOpen = pendingPermission !== null && !isPendingPermissionMinimized;

  const waitWithTimeout = useCallback(
    async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise.then(
          (value) => {
            window.clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            window.clearTimeout(timer);
            reject(error);
          }
        );
      });
    },
    []
  );

  const shouldShowOnboarding = useCallback(async (config: EnterpriseConfig): Promise<boolean> => {
    const enabledValue = await window.electron.store.get(OnboardingState.EnabledKey);
    const onboardingEnabled = resolveOnboardingEnabled(config, enabledValue);
    if (!onboardingEnabled) {
      return false;
    }

    const completedOnboardingVersion = await window.electron.store.get(OnboardingState.CompletionKey);
    return completedOnboardingVersion !== OnboardingState.Version;
  }, []);

  // 初始化应用
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const initializeApp = async () => {
      const t0 = performance.now();
      const mark = (label: string) => {
        const elapsed = Math.round(performance.now() - t0);
        const msg = `initializeApp: ${label} (+${elapsed}ms)`;
        console.info(`[App] ${msg}`);
        try { window.electron?.log?.fromRenderer?.('info', 'App', msg); } catch { /* preload may not expose this yet */ }
      };

      try {
        mark('start');
        document.documentElement.classList.add(`platform-${window.electron.platform}`);

        const initTimeoutMs =
          window.electron.platform === 'win32'
            ? INIT_STEP_TIMEOUT_MS_WINDOWS
            : INIT_STEP_TIMEOUT_MS_DEFAULT;
        mark('configService.init begin');
        await waitWithTimeout(configService.init(), initTimeoutMs, 'configService.init');
        mark('configService.init done');

        const entConfig = await window.electron.enterprise.getConfig();
        setEnterpriseConfig(entConfig);
        mark('enterprise.getConfig done');

        themeService.initialize();
        mark('themeService done');

        mark('i18nService.initialize begin');
        await waitWithTimeout(i18nService.initialize(), initTimeoutMs, 'i18nService.initialize');
        mark('i18nService.initialize done');

        mark('authService.init begin');
        await authService.init();
        mark('authService.init done');

        const config = await configService.getConfig();
        applyTypographyPreferences(config);
        const apiConfig: ApiConfig = {
          apiKey: config.api.key,
          baseUrl: config.api.baseUrl,
        };
        apiService.setConfig(apiConfig);

        const providerModels: { id: string; name: string; provider?: string; providerKey?: string; openClawProviderId?: string; supportsImage?: boolean }[] = [];
        if (config.providers) {
          Object.entries(config.providers).forEach(([providerName, providerConfig]) => {
            if (providerConfig.enabled && providerConfig.models) {
              const openClawProviderId = ProviderRegistry.getOpenClawProviderIdForConfig(providerName, providerConfig);
              if (providerName === ProviderName.Minimax && providerConfig.authType === ProviderAuthType.OAuth) {
                mark('MiniMax OAuth provider resolved to OpenClaw minimax-portal');
              }
              providerConfig.models.forEach((model: { id: string; name: string; supportsImage?: boolean }) => {
                providerModels.push({
                  id: model.id,
                  name: model.name,
                  provider: getProviderDisplayName(providerName, providerConfig),
                  providerKey: providerName,
                  openClawProviderId,
                  supportsImage: model.supportsImage ?? false,
                });
              });
            }
          });
        }
        dispatch(setAvailableModels(providerModels));
        if (providerModels.length > 0) {
          const allModels = store.getState().model.availableModels;
          const preferredModel = allModels.find(
            model => model.id === config.model.defaultModel
              && (!config.model.defaultModelProvider || model.providerKey === config.model.defaultModelProvider)
          ) ?? allModels[0];
          dispatch(setDefaultSelectedModel(preferredModel));
        }
        mark('model resolution done');

        const agreed = await window.electron.store.get('privacy_agreed');
        const hasAgreedToPrivacy = agreed === true;
        setPrivacyAgreed(hasAgreedToPrivacy);
        if (hasAgreedToPrivacy) {
          setShowWelcome(await shouldShowOnboarding(entConfig));
        } else {
          setShowWelcome(false);
        }
        mark('privacy check done');

        setIsInitialized(true);
        mark('shell ready');
        if (!hasReportedAppStartedRef.current) {
          hasReportedAppStartedRef.current = true;
          void reportYdAnalyzer({
            action: LogReporterAction.AppStarted,
            providerModelCount: providerModels.length,
            hasLoggedInUser: !!store.getState().auth.user?.yid,
          });
        }

        void waitWithTimeout(
          scheduledTaskService.init(),
          SCHEDULED_TASK_INIT_TIMEOUT_MS,
          'scheduledTaskService.init',
        ).catch((error) => {
          console.error('[App] initializeApp: scheduledTaskService.init failed:', error);
        });

      } catch (error) {
        const elapsed = Math.round(performance.now() - t0);
        const msg = error instanceof Error ? error.message : String(error);
        const detail = `initializeApp FAILED after ${elapsed}ms: ${msg}`;
        console.error(`[App] ${detail}`);
        try { window.electron?.log?.fromRenderer?.('error', 'App', detail); } catch { /* best-effort */ }
        setInitError(i18nService.t('initializationError'));
        setIsInitialized(true);
      }
    };

    void initializeApp();
  }, [dispatch, shouldShowOnboarding, waitWithTimeout]);

  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      forceLanguageRefresh((prev) => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authUser) {
      void authService.fetchProfileSummary();
    }
  }, [authUser]);

  // Listen for Copilot token auto-refresh events from the main process
  useEffect(() => {
    const removeListener = window.electron.githubCopilot.onTokenUpdated(({ token, baseUrl }) => {
      console.log('[App] received Copilot token update from main process');
      apiService.setProviderRuntimeCredential(ProviderName.Copilot, {
        apiKey: token,
        ...(baseUrl ? { baseUrl } : {}),
      });
    });
    return removeListener;
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Renderer] Network online');
      window.electron.networkStatus.send('online');
    };

    const handleOffline = () => {
      console.log('[Renderer] Network offline');
      window.electron.networkStatus.send('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || !defaultSelectedModel?.id) return;
    const config = configService.getConfig();
    if (
      config.model.defaultModel === defaultSelectedModel.id
      && (config.model.defaultModelProvider ?? '') === (defaultSelectedModel.providerKey ?? '')
    ) {
      return;
    }
    void configService.updateConfig({
      model: {
        ...config.model,
        defaultModel: defaultSelectedModel.id,
        defaultModelProvider: defaultSelectedModel.providerKey,
      },
    });
  }, [isInitialized, defaultSelectedModel?.id, defaultSelectedModel?.providerKey]);

  const handleShowSettings = useCallback((options?: SettingsOpenOptions) => {
    setShowPersonalCenter(false);
    setSettingsOptions((current) => ({
      initialTab: options?.initialTab,
      notice: options?.notice,
      noticeI18nKey: options?.noticeI18nKey,
      noticeExtra: options?.noticeExtra,
      requestId: current.requestId + 1,
    }));
    setShowSettings(true);
  }, []);

  const handleShowPersonalCenter = useCallback(() => {
    setShowSettings(false);
    setShowPersonalCenter(true);
  }, []);

  const handleShowSkills = useCallback(() => {
    setMainView('skills');
  }, []);

  const handleShowCowork = useCallback(() => {
    setMainView('cowork');
  }, []);

  const handleShowScheduledTasks = useCallback(() => {
    setMainView('scheduledTasks');
  }, []);

  const handleShowMcp = useCallback(() => {
    setMainView('mcp');
  }, []);

  const handleShowKits = useCallback(() => {
    setMainView('kits');
  }, []);

  const handleShowBusinessCenter = useCallback(() => {
    setMainView('businessCenter');
  }, []);

  useEffect(() => {
    if (mainView === 'businessCenter' && !canAccessBusinessCenter) {
      setMainView('cowork');
    }
  }, [canAccessBusinessCenter, mainView]);

  const openHomeWithKit = useCallback((kitId: string, text?: string) => {
    dispatch(setActiveKitIds([kitId]));
    coworkService.clearSession({ restoreAgentSkills: true });
    dispatch(clearSelection());
    if (text !== undefined) {
      dispatch(setDraftCollaborationMode({
        draftKey: '__home__',
        mode: CoworkCollaborationMode.Default,
      }));
      // Set the draft prompt before switching view, so that when CoworkPromptInput
      // mounts/updates with draftKey='__home__', it picks up the text.
      dispatch(setDraftPrompt({ sessionId: '__home__', draft: text }));
    }
    dispatch(setDraftKitIds({ draftKey: '__home__', kitIds: [kitId] }));
    setMainView('cowork');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(CoworkUiEvent.FocusInput, {
        // Without text, keep any existing home draft and just focus with the kit selected
        detail: text !== undefined ? { resetCollaborationMode: true, text } : { clear: false },
      }));
    }, 0);
  }, [dispatch]);

  const handleKitTryAsking = useCallback((text: string, kitId: string) => {
    openHomeWithKit(kitId, text);
  }, [openHomeWithKit]);

  const handleKitUse = useCallback((kitId: string) => {
    openHomeWithKit(kitId);
  }, [openHomeWithKit]);

  const handleToggleSidebar = useCallback(() => {
    const nextCollapsed = !isSidebarCollapsed;
    const message = `sidebar toggle requested activeView=${mainView} nextCollapsed=${nextCollapsed} platform=${window.electron.platform}`;
    console.debug(`[AppLayout] ${message}`);
    try {
      window.electron?.log?.fromRenderer?.('debug', 'AppLayout', message);
    } catch {
      // Logging should never block sidebar interactions.
    }
    void reportYdAnalyzer({
      action: LogReporterAction.SidebarAction,
      source: 'home_sidebar',
      actionType: isSidebarCollapsed ? 'expand_sidebar' : 'collapse_sidebar',
      activeView: mainView,
      isCollapsed: isSidebarCollapsed,
    });
    setIsSidebarCollapsed((prev) => !prev);
  }, [isSidebarCollapsed, mainView]);

  const handleNewChat = useCallback(() => {
    // Only clear when already on home (no session) — preserve __home__ draft when returning from a session
    const shouldClearInput = mainView === 'cowork' && !currentSessionId;
    coworkService.clearSession({ restoreAgentSkills: true });
    dispatch(clearSelection());
    dispatch(setDraftCollaborationMode({
      draftKey: '__home__',
      mode: CoworkCollaborationMode.Default,
    }));
    setMainView('cowork');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(CoworkUiEvent.FocusInput, {
        detail: { clear: shouldClearInput, resetCollaborationMode: true },
      }));
    }, 0);
  }, [dispatch, mainView, currentSessionId]);

  const handleCreateSkillByChat = useCallback(() => {
    dispatch(setDraftPrompt({ sessionId: '__home__', draft: i18nService.t('skillCreatorPrompt') }));
    coworkService.clearSession();
    dispatch(clearSelection());
    dispatch(setDraftCollaborationMode({
      draftKey: '__home__',
      mode: CoworkCollaborationMode.Default,
    }));
    setMainView('cowork');
  }, [dispatch]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadInitialUpdateState = async () => {
      try {
        const state = await window.electron.appUpdate.getState();
        if (mounted) {
          setAppUpdateState(state);
          previousUpdateStatusRef.current = state.status;
          // A previous install attempt quit the app without completing
          // (e.g. the installer never launched) — re-prompt the user.
          if (state.status === AppUpdateStatus.Ready && state.installIncomplete) {
            setShowUpdateModal(true);
          }
        }
      } catch (error) {
        console.error('[App] failed to load initial app update state:', error);
      }
    };

    void loadInitialUpdateState();

    const unsubscribe = window.electron.appUpdate.onStateChanged((state) => {
      const previousStatus = previousUpdateStatusRef.current;
      previousUpdateStatusRef.current = state.status;
      setAppUpdateState(state);

      if (state.status === AppUpdateStatus.Ready && previousStatus !== AppUpdateStatus.Ready) {
        if (shouldInstallReadyUpdateRef.current && state.readyFilePath) {
          shouldInstallReadyUpdateRef.current = false;
          void window.electron.appUpdate.installReady().then((installResult) => {
            if (!installResult.success) {
              showToast(installResult.error || i18nService.t('updateInstallFailed'));
            }
          });
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [showToast]);

  const handleShowLogin = useCallback(() => {
    setShowWelcome(false);
  }, []);

  const handlePasswordLogin = useCallback(async (account: string, password: string) => {
    await authService.loginWithPassword(account, password);
  }, []);

  const handleSkipLogin = useCallback(() => {
    setHasSkippedLogin(true);
    setMainView('cowork');
  }, []);

  const runUpdateCheck = useCallback(async () => {
    try {
      const result = await window.electron.appUpdate.checkNow({ userId: authUser?.yid });
      setAppUpdateState(result.state);
      if (!result.success) {
        console.error('[App] app update check failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to check app update:', error);
    }
  }, [authUser]);

  const updateInfo = appUpdateState.info;

  const handleOpenUpdateModal = useCallback(() => {
    if (!updateInfo) return;

    const message = `update modal requested status=${appUpdateState.status} source=${appUpdateState.source ?? 'none'} version=${updateInfo.latestVersion}`;
    console.debug(`[AppUpdate] ${message}`);
    try {
      window.electron?.log?.fromRenderer?.('debug', 'AppUpdate', message);
    } catch {
      // Best-effort diagnostic only.
    }
    setShowUpdateModal(true);
  }, [appUpdateState.source, appUpdateState.status, updateInfo]);

  const handleUpdateFound = useCallback((_info: AppUpdateInfo) => {
    setShowUpdateModal(true);
  }, []);

  const handleConfirmUpdate = useCallback(async () => {
    if (!updateInfo) return;

    if (appUpdateState.readyFilePath) {
      shouldInstallReadyUpdateRef.current = false;
      const installResult = await window.electron.appUpdate.installReady();
      if (!installResult.success) {
        showToast(installResult.error || i18nService.t('updateInstallFailed'));
      }
      return;
    }

    if (appUpdateState.status === AppUpdateStatus.Error || appUpdateState.status === AppUpdateStatus.Available) {
      if (!isManualDownloadUrl(updateInfo.url)) {
        // The user explicitly asked to update (or retry), so finish the whole
        // flow in one click: install and restart as soon as the download lands.
        shouldInstallReadyUpdateRef.current = true;
        const retryResult = await window.electron.appUpdate.retryDownload();
        if (!retryResult.success) {
          shouldInstallReadyUpdateRef.current = false;
          showToast(i18nService.t('updateDownloadFailed'));
        }
        return;
      }
    }

    if (isManualDownloadUrl(updateInfo.url)) {
      shouldInstallReadyUpdateRef.current = false;
      setShowUpdateModal(false);
      try {
        const result = await window.electron.shell.openExternal(updateInfo.url);
        if (!result.success) {
          showToast(i18nService.t('updateOpenFailed'));
        }
      } catch (error) {
        console.error('Failed to open update url:', error);
        showToast(i18nService.t('updateOpenFailed'));
      }
      return;
    }
  }, [appUpdateState.readyFilePath, appUpdateState.status, showToast, updateInfo]);

  const handleCancelDownload = useCallback(async () => {
    shouldInstallReadyUpdateRef.current = false;
    await window.electron.appUpdate.cancelDownload();
  }, []);

  const handleRetryUpdate = useCallback(async () => {
    if (!updateInfo) return;
    if (isManualDownloadUrl(updateInfo.url)) {
      shouldInstallReadyUpdateRef.current = false;
      setShowUpdateModal(false);
      await window.electron.shell.openExternal(updateInfo.url);
      return;
    }
    shouldInstallReadyUpdateRef.current = false;
    await window.electron.appUpdate.retryDownload();
  }, [updateInfo]);

  const handlePrivacyAccept = useCallback(async () => {
    await window.electron.store.set('privacy_agreed', true);
    setPrivacyAgreed(true);
    setShowWelcome(await shouldShowOnboarding(enterpriseConfig));
  }, [enterpriseConfig, shouldShowOnboarding]);

  const handlePrivacyReject = useCallback(() => {
    // 立刻隐藏窗口，让用户感觉立即关闭
    window.electron.window.close();
  }, []);

  const completeWelcome = useCallback(async () => {
    await window.electron.store.set(OnboardingState.CompletionKey, OnboardingState.Version);
    setShowWelcome(false);
  }, []);

  const handleWelcomeClose = useCallback(() => {
    void completeWelcome().catch((error) => {
      console.error('[Onboarding] Failed to persist completion state:', error);
    });
  }, [completeWelcome]);

  const handleWelcomeStart = useCallback(async () => {
    await completeWelcome();
    if (!authIsLoggedIn) {
      handleShowLogin();
    }
  }, [authIsLoggedIn, completeWelcome, handleShowLogin]);

  const handlePermissionResponse = useCallback(async (result: CoworkPermissionResult) => {
    if (!pendingPermission) return;
    await coworkService.respondToPermission(pendingPermission.requestId, result);
  }, [pendingPermission]);

  const handleMinimizePermission = useCallback(() => {
    if (!pendingPermission) return;
    setMinimizedPermissionIds((previous) => (
      previous.includes(pendingPermission.requestId)
        ? previous
        : [...previous, pendingPermission.requestId]
    ));
  }, [pendingPermission]);

  const handleRestorePermission = useCallback(() => {
    if (!pendingPermission) return;
    setMinimizedPermissionIds((previous) => (
      previous.filter((requestId) => requestId !== pendingPermission.requestId)
    ));
  }, [pendingPermission]);

  useEffect(() => {
    const activeRequestIds = new Set(pendingPermissions.map((permission) => permission.requestId));
    setMinimizedPermissionIds((previous) => {
      const next = previous.filter((requestId) => activeRequestIds.has(requestId));
      return next.length === previous.length ? previous : next;
    });
  }, [pendingPermissions]);

  const handleCloseSettings = () => {
    setShowSettings(false);
    const config = configService.getConfig();
    apiService.setConfig({
      apiKey: config.api.key,
      baseUrl: config.api.baseUrl,
    });

    if (config.providers) {
      const allModels: { id: string; name: string; provider?: string; providerKey?: string; openClawProviderId?: string; supportsImage?: boolean }[] = [];
      Object.entries(config.providers).forEach(([providerName, providerConfig]) => {
        if (providerConfig.enabled && providerConfig.models) {
          const openClawProviderId = ProviderRegistry.getOpenClawProviderIdForConfig(providerName, providerConfig);
          providerConfig.models.forEach((model: { id: string; name: string; supportsImage?: boolean }) => {
            allModels.push({
              id: model.id,
              name: model.name,
              provider: getProviderDisplayName(providerName, providerConfig),
              providerKey: providerName,
              openClawProviderId,
              supportsImage: model.supportsImage ?? false,
            });
          });
        }
      });
      dispatch(setAvailableModels(allModels));
    }
  };

  const handleClosePersonalCenter = useCallback(() => {
    setShowPersonalCenter(false);
  }, []);

  const isShortcutInputActive = () => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    return activeElement.dataset.shortcutInput === 'true';
  };

  const isTextEditingActive = () => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    if (activeElement.isContentEditable) return true;
    if (activeElement instanceof HTMLTextAreaElement) return true;
    if (activeElement instanceof HTMLSelectElement) return true;
    return activeElement instanceof HTMLInputElement;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isShortcutInputActive() || isTextEditingActive()) return;

      const { shortcuts } = configService.getConfig();
      const activeShortcuts = {
        ...defaultConfig.shortcuts,
        ...(shortcuts ?? {}),
      };

      const matchesAction = (action: ShortcutAction) => matchesShortcut(event, activeShortcuts[action]);

      if (showSettings) {
        if (matchesAction(ShortcutAction.ShowShortcuts)) {
          event.preventDefault();
          handleShowSettings({ initialTab: 'shortcuts' });
        }
        return;
      }

      if (showUpdateModal || isPermissionModalOpen) return;

      if (matchesAction(ShortcutAction.NewChat)) {
        event.preventDefault();
        handleNewChat();
        return;
      }

      if (matchesAction(ShortcutAction.Search)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutSearch));
        return;
      }

      if (matchesAction(ShortcutAction.Settings)) {
        event.preventDefault();
        handleShowSettings();
        return;
      }

      if (matchesAction(ShortcutAction.ShowShortcuts)) {
        event.preventDefault();
        handleShowSettings({ initialTab: 'shortcuts' });
        return;
      }

      const settingsTabShortcut = SETTINGS_TAB_SHORTCUT_ACTIONS.find(({ action }) => matchesAction(action));
      if (settingsTabShortcut) {
        event.preventDefault();
        handleShowSettings({ initialTab: settingsTabShortcut.initialTab });
        return;
      }

      if (matchesAction(ShortcutAction.FocusPrompt)) {
        event.preventDefault();
        setMainView('cowork');
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent(CoworkUiEvent.FocusInput, {
            detail: { clear: false },
          }));
        }, 0);
        return;
      }

      if (matchesAction(ShortcutAction.StopCurrentTask)) {
        event.preventDefault();
        if (mainView === 'cowork') {
          window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutStopSession));
        } else if (currentSessionId) {
          void coworkService.stopSession(currentSessionId);
        }
        return;
      }

      if (matchesAction(ShortcutAction.ToggleSidebar)) {
        event.preventDefault();
        handleToggleSidebar();
        return;
      }

      if (matchesAction(ShortcutAction.ToggleArtifacts)) {
        event.preventDefault();
        setMainView('cowork');
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutToggleArtifacts));
        }, 0);
        return;
      }

      if (matchesAction(ShortcutAction.PreviousAgent)) {
        event.preventDefault();
        setMainView('cowork');
        setIsSidebarCollapsed(false);
        window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutSwitchAgent, {
          detail: { direction: CoworkShortcutDirection.Previous },
        }));
        return;
      }

      if (matchesAction(ShortcutAction.NextAgent)) {
        event.preventDefault();
        setMainView('cowork');
        setIsSidebarCollapsed(false);
        window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutSwitchAgent, {
          detail: { direction: CoworkShortcutDirection.Next },
        }));
        return;
      }

      if (matchesAction(ShortcutAction.ShowCurrentAgentTasks)) {
        event.preventDefault();
        setMainView('cowork');
        setIsSidebarCollapsed(false);
        window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutShowCurrentAgentTasks));
        return;
      }

      const taskSlotIndex = AGENT_TASK_SLOT_SHORTCUT_ACTIONS.findIndex(action => matchesAction(action));
      if (taskSlotIndex >= 0) {
        event.preventDefault();
        setMainView('cowork');
        setIsSidebarCollapsed(false);
        window.dispatchEvent(new CustomEvent(CoworkUiEvent.ShortcutOpenAgentTaskSlot, {
          detail: { slot: taskSlotIndex + 1 },
        }));
        return;
      }

      if (matchesAction(ShortcutAction.OpenCowork)) {
        event.preventDefault();
        handleShowCowork();
        return;
      }

      if (matchesAction(ShortcutAction.OpenScheduledTasks)) {
        event.preventDefault();
        handleShowScheduledTasks();
        return;
      }

      if (matchesAction(ShortcutAction.OpenKits)) {
        event.preventDefault();
        handleShowKits();
        return;
      }

      if (matchesAction(ShortcutAction.OpenSkills)) {
        event.preventDefault();
        handleShowSkills();
        return;
      }

      if (matchesAction(ShortcutAction.OpenMcp)) {
        event.preventDefault();
        handleShowMcp();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    currentSessionId,
    handleNewChat,
    handleShowCowork,
    handleShowKits,
    handleShowMcp,
    handleShowScheduledTasks,
    handleShowSettings,
    handleShowSkills,
    handleToggleSidebar,
    mainView,
    isPermissionModalOpen,
    showSettings,
    showUpdateModal,
  ]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Listen for toast events from child components
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      if (message) showToast(message);
    };
    window.addEventListener('app:showToast', handler);
    return () => window.removeEventListener('app:showToast', handler);
  }, [showToast]);

  // Listen for ask-ai events: close settings, navigate to cowork, pre-fill input
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setShowSettings(false);
      setMainView('cowork');
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(CoworkUiEvent.FocusInput, {
            detail: { text },
          }),
        );
      }, 50);
    };
    window.addEventListener('app:ask-ai', handler);
    return () => window.removeEventListener('app:ask-ai', handler);
  }, []);

  // 监听托盘菜单打开设置的 IPC 事件
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('app:openSettings', () => {
      handleShowSettings();
    });
    return unsubscribe;
  }, [handleShowSettings]);

  // 监听托盘菜单新建任务的 IPC 事件
  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('app:newTask', () => {
      handleNewChat();
    });
    return unsubscribe;
  }, [handleNewChat]);

  useEffect(() => {
    const unsubscribe = window.electron.cowork.onOpenSessionFromNotification?.(({ sessionId }) => {
      setShowSettings(false);
      setMainView('cowork');
      void coworkService.loadSession(sessionId);
    });
    void window.electron.cowork.notifyOpenSessionFromNotificationReady?.();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    // Enterprise mode: completely skip update detection
    if (enterpriseConfig?.disableUpdate) return;

    let cancelled = false;
    let lastCheckTime = 0;

    const maybeCheck = async (reason: 'startup' | 'heartbeat' | 'visibility') => {
      if (cancelled) return;
      const now = Date.now();
      if (lastCheckTime > 0 && now - lastCheckTime < APP_UPDATE_POLL_INTERVAL_MS) return;
      lastCheckTime = now;
      console.log(`[App] auto update check triggered, reason=${reason}, at=${new Date(now).toISOString()}`);
      await runUpdateCheck();
    };

    // 启动时立即检查
    void maybeCheck('startup');

    // 心跳：每 30 分钟检测是否距上次检查已超过 12 小时
    const timer = window.setInterval(() => {
      void maybeCheck('heartbeat');
    }, APP_UPDATE_HEARTBEAT_INTERVAL_MS);

    // 窗口恢复可见时检测（覆盖休眠唤醒场景）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void maybeCheck('visibility');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInitialized, runUpdateCheck, enterpriseConfig]);

  // 根据场景选择使用哪个权限组件。最小化时保持组件挂载（仅视觉隐藏），
  // 避免重新展开后丢失用户已选择/已输入的内容；key 按 requestId 隔离不同请求的状态。
  const permissionModal = useMemo(() => {
    if (!pendingPermission) return null;

    // 检查是否为 AskUserQuestion 且有多个问题 -> 使用向导式组件
    const isQuestionTool = pendingPermission.toolName === 'AskUserQuestion';
    if (isQuestionTool && pendingPermission.toolInput) {
      const rawQuestions = (pendingPermission.toolInput as Record<string, unknown>).questions;
      const hasMultipleQuestions = Array.isArray(rawQuestions) && rawQuestions.length > 1;

      if (hasMultipleQuestions) {
        return (
          <CoworkQuestionWizard
            key={pendingPermission.requestId}
            permission={pendingPermission}
            onRespond={handlePermissionResponse}
            onMinimize={handleMinimizePermission}
            hidden={isPendingPermissionMinimized}
          />
        );
      }
    }

    // 其他情况使用原有的权限模态框
    return (
      <CoworkPermissionModal
        key={pendingPermission.requestId}
        permission={pendingPermission}
        onRespond={handlePermissionResponse}
        onMinimize={handleMinimizePermission}
        hidden={isPendingPermissionMinimized}
      />
    );
  }, [pendingPermission, handlePermissionResponse, handleMinimizePermission, isPendingPermissionMinimized]);

  const isOverlayActive = showSettings || showPersonalCenter || showUpdateModal || isPermissionModalOpen;
  // Keep the badge visible while downloading so the collapsed-sidebar layouts
  // still surface progress; only a plain re-check hides nothing new.
  const shouldShowUpdateBadge = updateInfo && appUpdateState.status !== AppUpdateStatus.Checking;
  const updateBadge = shouldShowUpdateBadge ? (
    <AppUpdateBadge
      latestVersion={updateInfo.latestVersion}
      status={appUpdateState.status}
      progress={appUpdateState.progress?.percent}
      onClick={handleOpenUpdateModal}
    />
  ) : null;
  const updateCard = updateInfo ? (
    <AppUpdateCard
      updateState={appUpdateState}
      onUpdate={handleConfirmUpdate}
      onShowDetails={handleOpenUpdateModal}
      onCancelDownload={handleCancelDownload}
      onExpandedChange={setIsUpdateCardExpanded}
    />
  ) : null;
  const canUseWindowsTopBarActions = isInitialized && !initError;
  const canUseWindowsCollapsedTopBarActions = canUseWindowsTopBarActions && isSidebarCollapsed;
  const collapsedHeaderUpdateBadge = isSidebarCollapsed && !isWindows ? updateBadge : null;
  const windowsStandaloneTitleBar = isWindows ? (
    <WindowsAppTitleBar
      isOverlayActive={isOverlayActive}
      isSidebarCollapsed={isSidebarCollapsed}
      sidebarWidth={sidebarWidth}
      onToggleSidebar={canUseWindowsTopBarActions ? handleToggleSidebar : undefined}
      onNewChat={canUseWindowsCollapsedTopBarActions ? handleNewChat : undefined}
      sidebarToggleLabel={isSidebarCollapsed ? i18nService.t('expand') : i18nService.t('collapse')}
      newChatLabel={i18nService.t('newChat')}
      updateBadge={canUseWindowsCollapsedTopBarActions ? updateBadge : null}
    />
  ) : null;
  const windowsImmersiveTitleBar = isWindows ? (
    <div className="draggable absolute inset-x-0 top-0 z-[100] h-11 bg-transparent">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#010714]/78 via-[#010714]/28 to-transparent" />
      <WindowTitleBar
        isOverlayActive
        className="[&_button]:text-[#d7ecff]/78 [&_button:hover]:text-white [&_button:not(:last-child):hover]:bg-white/10 [&_button:not(:last-child):hover]:shadow-[0_8px_26px_rgba(92,231,255,0.16)] [&_button:last-child:hover]:bg-red-500 [&_button:last-child:hover]:shadow-[0_8px_26px_rgba(239,68,68,0.42)]"
      />
    </div>
  ) : null;

  if (!isInitialized) {
    // index.html's static splash shows the same startup page until React
    // mounts; rendering EngineStartupOverlay from the first frame keeps the
    // whole startup on one continuous screen with no visual handoff.
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 bg-surface" />
        <EngineStartupOverlay bootstrapping />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 flex flex-col items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-6 max-w-md px-6">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
            </div>
            <div className="text-foreground text-xl font-medium text-center">{initError}</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.electron.appInfo.relaunch()}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors text-sm font-medium"
              >
                {i18nService.t('restartApp')}
              </button>
              <button
                onClick={() => handleShowSettings()}
                className="px-6 py-2.5 border border-border text-foreground hover:bg-surface-raised rounded-xl transition-colors text-sm font-medium"
              >
                {i18nService.t('openSettings')}
              </button>
            </div>
          </div>
          {showSettings && (
            <Settings
              onClose={handleCloseSettings}
              initialTab={settingsOptions.initialTab}
              initialTabRequestId={settingsOptions.requestId}
              notice={settingsOptions.notice}
              onUpdateFound={handleUpdateFound}
              enterpriseConfig={enterpriseConfig}
            />
          )}
        </div>
      </div>
    );
  }

  if (privacyAgreed === false) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-background">
        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}
        {windowsStandaloneTitleBar}
        <div className="relative min-h-0 flex-1">
          <PrivacyDialog
            onAccept={handlePrivacyAccept}
            onReject={handlePrivacyReject}
          />
        </div>
      </div>
    );
  }

  if (privacyAgreed !== true || authIsLoading) {
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-glow-accent animate-pulse">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
            </div>
            <div className="text-foreground text-xl font-medium">{i18nService.t('loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!authIsLoggedIn && !hasSkippedLogin) {
    return (
      <div className="relative h-screen overflow-hidden flex flex-col bg-[#020714]">
        {toastMessage && (
          <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
        )}
        {showWelcome ? windowsStandaloneTitleBar : windowsImmersiveTitleBar}
        {showWelcome ? (
          <WelcomeDialog
            onStart={handleWelcomeStart}
            onClose={handleWelcomeClose}
            requireLogin
          />
        ) : (
          <LoginRequiredScreen
            onPasswordLogin={handlePasswordLogin}
            onSkipLogin={handleSkipLogin}
            hasImmersiveTitleBar={isWindows}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-surface-raised">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
      {windowsStandaloneTitleBar}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          onShowLogin={handleShowLogin}
          onShowSettings={handleShowSettings}
          onShowPersonalCenter={handleShowPersonalCenter}
          activeView={mainView}
          onShowSkills={handleShowSkills}
          onShowCowork={handleShowCowork}
          onShowScheduledTasks={handleShowScheduledTasks}
          onShowKits={handleShowKits}
          onShowMcp={handleShowMcp}
          onShowBusinessCenter={handleShowBusinessCenter}
          onNewChat={handleNewChat}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onWidthChange={setSidebarWidth}
          updateNotice={!isSidebarCollapsed ? updateCard : null}
          hideAdBanner={isUpdateCardExpanded}
          hideLogin={enterpriseConfig?.ui?.login === 'hide'}
        />
        <div className={`flex-1 min-w-0 transition-[padding] duration-200 ease-out ${isSidebarCollapsed ? 'pl-1.5' : ''}`}>
          <div className="relative h-full min-h-0 rounded-xl border border-border bg-background overflow-hidden">
            <EngineStartupOverlay />
            {mainView === 'skills' ? (
              <SkillsView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                onCreateSkillByChat={handleCreateSkillByChat}
                updateBadge={collapsedHeaderUpdateBadge}
                readOnly={enterpriseConfig?.ui?.skills === 'readonly'}
              />
            ) : mainView === 'scheduledTasks' ? (
              <ScheduledTasksView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={collapsedHeaderUpdateBadge}
              />
            ) : mainView === 'kits' ? (
              <KitsView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={collapsedHeaderUpdateBadge}
                onTryAsking={handleKitTryAsking}
                onUseKit={handleKitUse}
              />
            ) : mainView === 'mcp' ? (
              <McpView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={collapsedHeaderUpdateBadge}
              />
            ) : mainView === 'businessCenter' ? (
              <BusinessCenterView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : (
              <CoworkView
                onRequestAppSettings={privacyAgreed === true && !showWelcome ? handleShowSettings : undefined}
                onShowSkills={handleShowSkills}
                onShowKits={handleShowKits}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={collapsedHeaderUpdateBadge}
                minimizedPermission={isPendingPermissionMinimized ? pendingPermission : null}
                onRestorePermission={handleRestorePermission}
                onRespondToPermission={handlePermissionResponse}
              />
            )}
          </div>
        </div>
      </div>

      <EngineFailureOverlay
        onRequestAppSettings={privacyAgreed === true && !showWelcome ? handleShowSettings : undefined}
        suspended={showSettings || showPersonalCenter || showUpdateModal || isPermissionModalOpen || showWelcome}
      />

      {/* 设置窗口显示在所有主内容之上，但不影响主界面的交互 */}
      {showSettings && (
        <Settings
          onClose={handleCloseSettings}
          initialTab={settingsOptions.initialTab}
          initialTabRequestId={settingsOptions.requestId}
          notice={settingsOptions.notice}
          onUpdateFound={handleUpdateFound}
          enterpriseConfig={enterpriseConfig}
        />
      )}
      {showPersonalCenter && (
        <PersonalCenter onClose={handleClosePersonalCenter} />
      )}
      {showUpdateModal && updateInfo && (
        <AppUpdateModal
          updateState={appUpdateState}
          onCancel={() => {
            if (appUpdateState.status !== AppUpdateStatus.Downloading && appUpdateState.status !== AppUpdateStatus.Installing) {
              setShowUpdateModal(false);
            }
          }}
          onConfirm={handleConfirmUpdate}
          onCancelDownload={handleCancelDownload}
          onRetry={handleRetryUpdate}
        />
      )}
      {permissionModal}
      {showWelcome && (
        <WelcomeDialog
          onStart={handleWelcomeStart}
          onClose={handleWelcomeClose}
        />
      )}
    </div>
  );
};

export default App; 
