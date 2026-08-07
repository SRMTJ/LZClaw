import type { AuthLoginInAppBounds } from '@shared/auth/constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { APP_NAME } from '@/constants/app';
import { i18nService } from '@/services/i18n';

const LOGO_RINGS: Array<{ size: number; opacity: number }> = [
  { size: 150, opacity: 0.55 },
  { size: 255, opacity: 0.4 },
  { size: 380, opacity: 0.28 },
  { size: 560, opacity: 0.16 },
];

/** Maximum time (ms) to wait for the login callback before showing a retry option. */
const LOGIN_TIMEOUT_MS = 120_000;

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
  const [loginTimedOut, setLoginTimedOut] = useState(false);
  const loginHostRef = useRef<HTMLDivElement>(null);
  const loginStartedRef = useRef(false);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const cancelLogin = useCallback(() => {
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }
    setLoginActive(false);
    setLoginTimedOut(false);
    setLoginError(null);
    loginStartedRef.current = false;
    onLoginCancel();
  }, [onLoginCancel]);

  const handleLoginRetry = useCallback(() => {
    // Toggle loginActive off-then-on to force the effect to re-run a fresh login
    loginStartedRef.current = false;
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
      loginTimeoutRef.current = null;
    }
    setLoginTimedOut(false);
    setLoginActive(false);
    // Defer re-activation so React can process the false → true transition
    requestAnimationFrame(() => {
      void window.electron.auth.closeLoginInApp();
      setLoginActive(true);
    });
  }, []);

  useEffect(() => {
    if (!loginActive) return;
    const host = loginHostRef.current;
    if (!host) return;

    const startLogin = () => {
      const bounds = syncLoginBounds();
      if (!bounds || loginStartedRef.current) return;
      loginStartedRef.current = true;

      // Start a timeout to allow retry if the callback chain stalls
      loginTimeoutRef.current = setTimeout(() => {
        if (loginStartedRef.current) {
          console.warn('[WelcomeDialog] login timed out after', LOGIN_TIMEOUT_MS, 'ms');
          setLoginTimedOut(true);
        }
      }, LOGIN_TIMEOUT_MS);

      Promise.resolve(onLogin(bounds)).catch((error) => {
        console.error('[WelcomeDialog] failed to start embedded login:', error);
        setLoginError(i18nService.t('welcomeLoginOpenFailed'));
        cancelLogin();
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
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }
      loginStartedRef.current = false;
      void window.electron.auth.closeLoginInApp();
    };
  }, [loginActive, onLogin, onLoginCancel, cancelLogin, syncLoginBounds]);

  const copyright = i18nService
    .t('welcomeCopyright')
    .replace('{year}', String(new Date().getFullYear()));

  if (loginActive) {
    return (
      <div className="fixed inset-0 z-[60] overflow-hidden bg-white">
        <div ref={loginHostRef} className="absolute inset-0 bg-white">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {loginTimedOut ? (
              <>
                <p className="text-sm text-secondary">
                  {i18nService.t('welcomeLoginTimeout')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLoginRetry}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'rgba(72, 133, 255, 1)' }}
                  >
                    {i18nService.t('welcomeLoginRetry')}
                  </button>
                  <button
                    onClick={cancelLogin}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-secondary border border-border bg-transparent hover:text-foreground transition-colors"
                  >
                    {i18nService.t('welcomeCancel')}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-secondary">
                {i18nService.t('welcomeLoginLoading')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-surface flex flex-col items-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(640px 420px at 12% -6%, rgba(255, 77, 46, 0.07), transparent 70%), '
            + 'radial-gradient(720px 480px at 88% 106%, rgba(59, 130, 246, 0.06), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-[320px]">
        <div className="relative mb-6">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
            style={{
              width: 560,
              height: 560,
              maskImage: 'linear-gradient(to bottom, black 50%, transparent 76%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 76%)',
            }}
          >
            {LOGO_RINGS.map(({ size, opacity }) => (
              <div
                key={size}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border"
                style={{ width: size, height: size, opacity }}
              />
            ))}
          </div>
          <img
            src="logo.png"
            alt={APP_NAME}
            width={72}
            height={72}
            className="relative rounded-2xl select-none"
            draggable={false}
          />
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-8 text-center">
          {i18nService.t('welcomeTitle')}
        </h1>

        <div className="flex min-h-[140px] w-full flex-col items-center">
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
              className="w-full h-11 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 shadow-[0_4px_14px_rgba(72,133,255,0.35)] outline-none"
              style={{ backgroundColor: 'rgba(72, 133, 255, 1)' }}
            >
              {i18nService.t('welcomeLogin')}
            </button>
          </div>

          {!loginRequired && (
            <button
              onClick={onCustomModel}
              className="mt-3 w-full h-11 rounded-xl text-sm font-medium text-secondary border border-border bg-transparent hover:text-foreground hover:bg-surface-raised transition-colors outline-none"
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

      <div className="relative z-10 flex flex-col items-center gap-1 pb-8 px-8 text-center">
        <p className="text-xs text-secondary/70">{copyright}</p>
      </div>
    </div>
  );
};

export default WelcomeDialog;
