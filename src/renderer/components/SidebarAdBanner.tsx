import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { getPortalInvitationUrl } from '../services/endpoints';
import { i18nService } from '../services/i18n';
import { RootState } from '../store';

interface ClientBanner {
  id: number;
  activityDescription: string;
  linkUrl: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  updatedAt?: string;
}

interface DismissState {
  closeCount: number;
  closedAt: number;
}

const storageKeyFor = (userKey: string, banner: ClientBanner) => (
  `client_sidebar_banner.${userKey}.${banner.id}.${banner.updatedAt ?? 'v1'}`
);

const readDismissState = (key: string): DismissState | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DismissState>;
    if (typeof parsed.closeCount !== 'number' || typeof parsed.closedAt !== 'number') {
      return null;
    }
    return { closeCount: parsed.closeCount, closedAt: parsed.closedAt };
  } catch {
    return null;
  }
};

const shouldShowBanner = (state: DismissState | null) => {
  if (!state) return true;
  return state.closeCount < 1;
};

const SidebarAdBanner: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const profileSummary = useSelector((state: RootState) => state.auth.profileSummary);
  const [banner, setBanner] = useState<ClientBanner | null>(null);
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);

  const userKey = profileSummary?.id?.toString()
    ?? user?.id?.toString()
    ?? user?.userId
    ?? user?.yid
    ?? 'anonymous';

  useEffect(() => {
    let isCurrent = true;

    const loadBanner = async () => {
      try {
        const result = await window.electron.auth.getActiveClientBanner();
        if (!isCurrent) return;
        if (result.success && result.data) {
          setBanner(result.data as ClientBanner);
        } else {
          setBanner(null);
        }
      } catch {
        if (isCurrent) setBanner(null);
      }
    };

    void loadBanner();
    return () => {
      isCurrent = false;
    };
  }, [userKey]);

  const storageKey = useMemo(() => (
    banner ? storageKeyFor(userKey, banner) : null
  ), [banner, userKey]);

  useEffect(() => {
    if (!storageKey) {
      setHiddenKey(null);
      return;
    }
    const dismissState = readDismissState(storageKey);
    setHiddenKey(shouldShowBanner(dismissState) ? null : storageKey);
  }, [storageKey]);

  if (!banner || !storageKey || hiddenKey === storageKey) {
    return null;
  }

  const dismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const next: DismissState = { closeCount: 1, closedAt: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setHiddenKey(storageKey);
  };

  const openBanner = async () => {
    await window.electron.shell.openExternal(banner.linkUrl || getPortalInvitationUrl());
  };

  const imageAspectRatio = banner.imageWidth && banner.imageHeight
    ? `${banner.imageWidth} / ${banner.imageHeight}`
    : '16 / 5';

  return (
    <div className="pb-1">
      <div
        role="button"
        tabIndex={0}
        onClick={() => void openBanner()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void openBanner();
          }
        }}
        className="group relative block w-full overflow-hidden rounded-none transition-opacity hover:opacity-95"
        style={{ aspectRatio: imageAspectRatio }}
        aria-label={banner.activityDescription}
      >
        <img
          src={banner.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <button
          type="button"
          aria-label={i18nService.t('close')}
          onClick={dismiss}
          onKeyDown={(event) => event.stopPropagation()}
          className="absolute right-1 top-1 z-20 hidden h-5 w-5 items-center justify-center rounded-full bg-black/20 text-xs leading-none text-white transition-colors hover:bg-black/35 group-hover:flex group-focus-within:flex"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default SidebarAdBanner;
