import React, { useEffect, useState } from 'react';

interface WindowTitleBarProps {
  isOverlayActive?: boolean;
  inline?: boolean;
  className?: string;
}

type WindowState = {
  isMaximized: boolean;
  isFullscreen: boolean;
  isFocused: boolean;
};

const DEFAULT_STATE: WindowState = {
  isMaximized: false,
  isFullscreen: false,
  isFocused: true,
};

const controlButtonClassName =
  'non-draggable group h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:bg-surface-raised/90 hover:text-foreground hover:shadow-[0_8px_22px_rgba(15,23,42,0.14)] active:translate-y-0 active:scale-[0.97]';

const closeButtonClassName =
  'non-draggable group h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:bg-red-500 hover:text-white hover:shadow-[0_8px_24px_rgba(239,68,68,0.38)] active:translate-y-0 active:scale-[0.97] dark:hover:bg-red-500';

const controlIconClassName = 'h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-105';

const WindowTitleBar: React.FC<WindowTitleBarProps> = ({
  isOverlayActive = false,
  inline = false,
  className = '',
}) => {
  const [state, setState] = useState<WindowState>(DEFAULT_STATE);

  useEffect(() => {
    let disposed = false;
    window.electron.window.isMaximized().then((isMaximized) => {
      if (!disposed) {
        setState((prev) => ({ ...prev, isMaximized }));
      }
    }).catch((error) => {
      console.error('Failed to get initial maximize state:', error);
    });

    const unsubscribe = window.electron.window.onStateChanged((nextState) => {
      setState(nextState);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const handleMinimize = () => {
    window.electron.window.minimize();
  };

  const handleToggleMaximize = () => {
    window.electron.window.toggleMaximize();
  };

  const handleClose = () => {
    window.electron.window.close();
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    window.electron.window.showSystemMenu({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleDoubleClick = () => {
    if (!state.isFullscreen) {
      handleToggleMaximize();
    }
  };

  if (window.electron.platform !== 'win32') {
    return null;
  }

  const containerClassName = inline
    ? `window-controls-floating non-draggable flex h-8 items-center gap-0.5 transition-colors ${!state.isFocused ? 'opacity-70' : 'opacity-100'} ${className}`.trim()
    : `window-controls-floating non-draggable absolute top-0 right-0 z-[55] flex h-full items-center gap-0.5 rounded-bl-xl pl-1 pb-1 pt-0.5 transition-colors ${
      !state.isFocused ? 'opacity-70' : 'opacity-100'
    } ${
      isOverlayActive
        ? 'bg-transparent'
        : 'bg-surface/35 backdrop-blur-sm'
    } ${className}`.trim();

  return (
    <div
      className={containerClassName}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        onClick={handleMinimize}
        className={controlButtonClassName}
        aria-label="最小化"
        title="最小化"
      >
        <svg viewBox="0 0 12 12" className={controlIconClassName} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6h8" />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleToggleMaximize}
        className={controlButtonClassName}
        aria-label={state.isMaximized ? '还原' : '最大化'}
        title={state.isMaximized ? '还原' : '最大化'}
      >
        {state.isMaximized ? (
          <svg viewBox="0 0 12 12" className={controlIconClassName} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h6.5v6.5" />
            <path d="M1.5 4h7v7h-7z" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" className={controlIconClassName} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2h8v8H2z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={handleClose}
        className={closeButtonClassName}
        aria-label="关闭"
        title="关闭"
      >
        <svg viewBox="0 0 12 12" className={controlIconClassName} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l6 6" />
          <path d="M9 3L3 9" />
        </svg>
      </button>
    </div>
  );
};

export default WindowTitleBar;
