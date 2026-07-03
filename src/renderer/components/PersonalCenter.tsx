import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  CreditCardIcon,
  IdentificationIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { authService } from '../services/auth';
import { i18nService } from '../services/i18n';
import type { RootState } from '../store';
import type { CreditItem } from '../store/slices/authSlice';
import Modal from './common/Modal';
import UserAvatarIcon from './icons/UserAvatarIcon';

interface PersonalCenterProps {
  onClose: () => void;
}

const formatCredits = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

const formatStatus = (value?: string | null): string => {
  if (!value) return '-';
  if (value === 'active') return i18nService.t('enabled');
  if (value === 'free') return i18nService.t('planFree');
  return value;
};

const CreditBreakdownRow: React.FC<{ item: CreditItem }> = ({ item }) => {
  const isEn = i18nService.getLanguage() === 'en';
  const label = isEn ? item.labelEn : item.label;
  const expiresText = item.expiresAt
    ? `${i18nService.t('authExpiresAt')} ${item.expiresAt}`
    : i18nService.t('personalCenterNoExpiry');

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 truncate text-xs text-secondary">{expiresText}</div>
      </div>
      <div className="shrink-0 text-sm font-semibold text-foreground">
        {formatCredits(item.creditsRemaining)}
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border/70 py-3 last:border-b-0">
    <span className="shrink-0 text-sm text-secondary">{label}</span>
    <span className="min-w-0 truncate text-right text-sm font-medium text-foreground">{value}</span>
  </div>
);

const PersonalCenter: React.FC<PersonalCenterProps> = ({ onClose }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const quota = useSelector((state: RootState) => state.auth.quota);
  const profileSummary = useSelector((state: RootState) => state.auth.profileSummary);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayName = user?.nickname?.trim()
    || profileSummary?.nickname?.trim()
    || user?.phone?.trim()
    || user?.yid?.trim()
    || i18nService.t('user');

  const userId = useMemo(() => {
    if (user?.userId) return user.userId;
    if (typeof user?.id === 'number') return String(user.id);
    if (typeof profileSummary?.id === 'number') return String(profileSummary.id);
    return user?.yid || '-';
  }, [profileSummary?.id, user?.id, user?.userId, user?.yid]);

  const totalCredits = profileSummary?.totalCreditsRemaining ?? quota?.creditsRemaining;
  const creditItems = profileSummary?.creditItems ?? [];

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      await Promise.all([
        authService.refreshQuota(),
        authService.fetchProfileSummary(),
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18nService.t('personalCenterRefreshFailed'));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setErrorMessage(null);
    try {
      await authService.logout();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18nService.t('personalCenterLogoutFailed'));
      setIsLoggingOut(false);
    }
  }, [onClose]);

  return (
    <Modal
      onClose={onClose}
      overlayClassName="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-3 sm:p-4"
      className="w-[calc(100vw-1.5rem)] max-w-[760px] min-w-0 sm:w-[calc(100vw-2rem)]"
    >
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-modal modal-content">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {i18nService.t('personalCenter')}
            </h2>
            <p className="mt-1 text-sm text-secondary">
              {i18nService.t('personalCenterSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={i18nService.t('close')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-5">
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-muted text-primary">
                  {user?.avatarUrl || profileSummary?.avatarUrl ? (
                    <img
                      src={user?.avatarUrl || profileSummary?.avatarUrl || ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserAvatarIcon className="h-10 w-10" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xl font-semibold text-foreground">{displayName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1">
                      <IdentificationIcon className="h-3.5 w-3.5" />
                      {i18nService.t('personalCenterUserId')}: {userId}
                    </span>
                    {user?.phone && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-1">
                        <UserCircleIcon className="h-3.5 w-3.5" />
                        {user.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <UserCircleIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {i18nService.t('personalCenterAccountInfo')}
                  </h3>
                </div>
                <InfoRow label={i18nService.t('personalCenterAccountStatus')} value={String(user?.status ?? '-')} />
                <InfoRow label={i18nService.t('personalCenterPlan')} value={quota?.planName || '-'} />
                <InfoRow
                  label={i18nService.t('personalCenterSubscriptionStatus')}
                  value={formatStatus(quota?.subscriptionStatus)}
                />
              </section>

              <section className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCardIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {i18nService.t('personalCenterQuotaOverview')}
                  </h3>
                </div>
                <InfoRow
                  label={i18nService.t('personalCenterCreditsRemaining')}
                  value={`${formatCredits(totalCredits)} ${i18nService.t('authCreditsUnit')}`}
                />
                <InfoRow
                  label={i18nService.t('personalCenterCreditsLimit')}
                  value={`${formatCredits(quota?.creditsLimit)} ${i18nService.t('authCreditsUnit')}`}
                />
                <InfoRow
                  label={i18nService.t('personalCenterCreditsUsed')}
                  value={`${formatCredits(quota?.creditsUsed)} ${i18nService.t('authCreditsUnit')}`}
                />
              </section>
            </div>

            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  {i18nService.t('personalCenterCreditBreakdown')}
                </h3>
              </div>
              {creditItems.length > 0 ? (
                <div className="divide-y divide-border/70">
                  {creditItems.map((item, index) => (
                    <CreditBreakdownRow key={`${item.type}-${item.label}-${index}`} item={item} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-surface-raised px-3 py-3 text-sm text-secondary">
                  {i18nService.t('personalCenterNoCreditItems')}
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoggingOut}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? i18nService.t('personalCenterRefreshing') : i18nService.t('personalCenterRefresh')}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isRefreshing || isLoggingOut}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            {isLoggingOut ? i18nService.t('personalCenterLoggingOut') : i18nService.t('authLogout')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PersonalCenter;
