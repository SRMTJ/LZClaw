import type { AuthLoginInAppBounds } from '@shared/auth/constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { i18nService } from '@/services/i18n';

interface WelcomeDialogProps {
  loginRequired: boolean;
  onLogin: (bounds: AuthLoginInAppBounds) => void | Promise<void>;
  onLoginCancel: () => void;
  onCustomModel: () => void;
}

const WelcomeDialog: React.FC<WelcomeDialogProps> = ({
  loginRequired,
  onLogin,
  onLoginCancel,
  onCustomModel,
}) => {
  const [loginActive, setLoginActive] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const loginHostRef = useRef<HTMLDivElement>(null);
  const loginStartedRef = useRef(false);

  const readLoginBounds = useCallback((): AuthLoginInAppBounds | null => {
    const host = loginHostRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    if (rect.width < 320 || rect.height < 280) return null;
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }, []);

  const syncLoginBounds = useCallback((): AuthLoginInAppBounds | null => {
    const bounds = readLoginBounds();
    if (bounds) {
      void window.electron.auth.updateLoginInAppBounds(bounds);
    }
    return bounds;
  }, [readLoginBounds]);

  useEffect(() => {
    if (!loginActive) return;
    const host = loginHostRef.current;
    if (!host) return;

    const startLogin = () => {
      const bounds = syncLoginBounds();
      if (!bounds || loginStartedRef.current) return;
      loginStartedRef.current = true;
      Promise.resolve(onLogin(bounds)).catch((error) => {
        console.error('[WelcomeDialog] failed to start embedded login:', error);
        setLoginError(i18nService.t('welcomeLoginOpenFailed'));
        onLoginCancel();
        setLoginActive(false);
      });
    };

    const animationFrame = window.requestAnimationFrame(startLogin);
    const resizeObserver = new ResizeObserver(() => {
      syncLoginBounds();
    });
    resizeObserver.observe(host);
    window.addEventListener('resize', syncLoginBounds);
    window.addEventListener('scroll', syncLoginBounds, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncLoginBounds);
      window.removeEventListener('scroll', syncLoginBounds, true);
      loginStartedRef.current = false;
      void window.electron.auth.closeLoginInApp();
    };
  }, [loginActive, onLogin, onLoginCancel, syncLoginBounds]);

  if (loginActive) {
    return (
      <div className="fixed inset-0 z-[60] bg-surface flex items-center justify-center px-8 py-8">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(360deg, rgba(255, 0, 77, 0) 5.5%, rgba(255, 0, 77, 0.05) 100%)' }}
        />
        <div className="relative z-10 flex h-full max-h-[760px] w-full max-w-[960px] flex-col">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="logo.png"
                alt="LobsterAI"
                width={42}
                height={42}
                className="rounded-xl select-none"
                draggable={false}
              />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground">
                  {i18nService.t('welcomeTitle')}
                </h1>
                <p className="text-sm text-secondary">
                  {i18nService.t('welcomeSubtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onLoginCancel();
                setLoginActive(false);
              }}
              className="h-9 shrink-0 rounded-lg border border-border px-4 text-sm font-medium text-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              {i18nService.t('welcomeLoginBack')}
            </button>
          </div>

          <div
            ref={loginHostRef}
            className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_50px_rgba(20,18,11,0.08)]"
          >
            <div className="absolute inset-0 flex items-center justify-center text-sm text-secondary">
              {i18nService.t('welcomeLoginLoading')}
            </div>
          </div>

          {!loginRequired && (
            <button
              onClick={onCustomModel}
              className="mt-4 h-10 self-center rounded-lg border border-border px-5 text-sm font-medium text-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              {i18nService.t('welcomeCustomModel')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-surface flex items-center justify-center">
      {/* gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(360deg, rgba(255, 0, 77, 0) 5.5%, rgba(255, 0, 77, 0.05) 100%)' }}
      />

      {/* content */}
      <div className="relative z-10 flex flex-col items-center py-12 w-[420px]">
        {/* logo */}
        <img
          src="logo.png"
          alt="LobsterAI"
          width={72}
          height={72}
          className="rounded-2xl mb-5 select-none"
          draggable={false}
        />

        {/* title */}
        <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
          {i18nService.t('welcomeTitle')}
        </h1>

        {/* subtitle */}
        <p className="text-sm text-secondary mb-8 text-center">
          {i18nService.t('welcomeSubtitle')}
        </p>

        {/* action stack — login is the primary path, custom model stays visible but quiet */}
        <div className="flex flex-col w-[320px]">
          {/* promo badge — anchored above the login button as its incentive */}
          <div className="flex items-center gap-1.5" style={{ paddingLeft: 11, marginBottom: 10 }}>
            <img
              src="love.png"
              alt=""
              width={16}
              height={16}
              className="select-none shrink-0"
              draggable={false}
              aria-hidden="true"
            />
            <span className="text-sm text-secondary">{i18nService.t('welcomePromo')}</span>
          </div>

          {/* primary: login — hand image overlaps its bottom-left corner */}
          <div className="relative w-full overflow-visible">
            <img
              src="hand.png"
              alt=""
              width={41}
              height={55}
              className="absolute select-none pointer-events-none z-10"
              style={{ bottom: 0, left: -8 }}
              draggable={false}
              aria-hidden="true"
            />
            <button
              onClick={() => {
                setLoginError(null);
                setLoginActive(true);
              }}
              className="w-full h-11 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 shadow-[0_4px_14px_rgba(72,133,255,0.35)]"
              style={{ backgroundColor: 'rgba(72, 133, 255, 1)' }}
            >
              {i18nService.t('welcomeLogin')}
            </button>
          </div>

          {/* secondary: custom model — ghost style keeps it discoverable without competing */}
          {!loginRequired && (
            <button
              onClick={onCustomModel}
              className="mt-3 w-full h-10 rounded-xl text-sm font-medium text-secondary border border-border bg-transparent hover:text-foreground hover:bg-surface-raised transition-colors"
            >
              {i18nService.t('welcomeCustomModel')}
            </button>
          )}
          {loginError && (
            <p className="mt-3 text-center text-xs text-red-500">
              {loginError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeDialog;
