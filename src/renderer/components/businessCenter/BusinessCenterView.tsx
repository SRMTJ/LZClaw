import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type {
  BusinessCenterStatusUpdate,
  BusinessCenterViewBounds,
} from '@shared/businessCenter/constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { i18nService } from '../../services/i18n';

interface BusinessCenterViewProps {
  active: boolean;
}

const BusinessCenterView: React.FC<BusinessCenterViewProps> = ({ active }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const activeRef = useRef(active);
  const [status, setStatus] = useState<BusinessCenterStatusUpdate>({
    status: 'idle',
  });

  activeRef.current = active;

  const readBounds = useCallback((): BusinessCenterViewBounds | null => {
    const host = hostRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }, []);

  const open = useCallback(async (): Promise<void> => {
    const bounds = readBounds();
    if (!bounds || !activeRef.current) return;

    setStatus({ status: 'loading' });
    const result = await window.electron.businessCenter.open(bounds);
    if (!result.success) {
      openedRef.current = false;
      setStatus({
        status: 'error',
        error: result.error || i18nService.t('businessCenterLoadFailed'),
      });
      return;
    }
    openedRef.current = true;
  }, [readBounds]);

  const syncBounds = useCallback((): void => {
    if (!activeRef.current || !openedRef.current) return;
    const bounds = readBounds();
    if (bounds) {
      void window.electron.businessCenter.updateBounds(bounds);
    }
  }, [readBounds]);

  useEffect(() => window.electron.businessCenter.onStatus(setStatus), []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      if (!active) {
        void window.electron.businessCenter.setVisible(false);
        return;
      }

      if (openedRef.current) {
        syncBounds();
        void window.electron.businessCenter.setVisible(true);
      } else {
        void open();
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      void window.electron.businessCenter.setVisible(false);
    };
  }, [active, open, syncBounds]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const resizeObserver = new ResizeObserver(syncBounds);
    resizeObserver.observe(host);
    window.addEventListener('resize', syncBounds);
    window.addEventListener('scroll', syncBounds, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('scroll', syncBounds, true);
    };
  }, [syncBounds]);

  const handleRetry = useCallback(async () => {
    setStatus({ status: 'loading' });
    if (!openedRef.current) {
      await open();
      return;
    }

    const result = await window.electron.businessCenter.reload();
    if (!result.success) {
      setStatus({
        status: 'error',
        error: result.error || i18nService.t('businessCenterLoadFailed'),
      });
    }
  }, [open]);

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-0 w-full overflow-hidden bg-white"
    >
      {status.status === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium text-foreground">
            {i18nService.t('businessCenterLoadFailed')}
          </p>
          {status.error && (
            <p className="max-w-lg text-xs text-secondary">{status.error}</p>
          )}
          <button
            type="button"
            onClick={() => { void handleRetry(); }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-surface-raised"
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            {i18nService.t('businessCenterRetry')}
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-secondary">
          {i18nService.t('businessCenterLoading')}
        </div>
      )}
    </div>
  );
};

export default BusinessCenterView;
