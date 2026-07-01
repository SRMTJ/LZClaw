import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVersion: vi.fn(),
  getPath: vi.fn(),
  fetch: vi.fn(),
  getAllWindows: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
  cancelActiveDownload: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getVersion: mocks.getVersion,
    getPath: mocks.getPath,
  },
  session: {
    defaultSession: {
      fetch: mocks.fetch,
    },
  },
  BrowserWindow: {
    getAllWindows: mocks.getAllWindows,
  },
}));

vi.mock('./appUpdateInstaller', () => ({
  cancelActiveDownload: mocks.cancelActiveDownload,
  downloadUpdate: mocks.downloadUpdate,
  installUpdate: mocks.installUpdate,
}));

import { type AppUpdateInfo, type AppUpdateRuntimeState,AppUpdateSource, AppUpdateStatus } from '../../shared/appUpdate/constants';
import { AppUpdateCoordinator } from './appUpdateCoordinator';

type MockStore = {
  delete: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

const createStore = (): MockStore => {
  const values = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => values.get(key)),
    set: vi.fn((key: string, value: unknown) => {
      values.set(key, value);
    }),
    delete: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
};

describe('AppUpdateCoordinator', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getVersion.mockReturnValue('1.0.0');
    mocks.getPath.mockReturnValue('C:\\temp\\lzclaw-test');
    mocks.getAllWindows.mockReturnValue([]);
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, data: { value: null } }),
    });
    mocks.readdir.mockResolvedValue([]);
    const fs = await import('fs');
    vi.spyOn(fs.promises, 'unlink').mockImplementation(mocks.unlink);
    vi.spyOn(fs.promises, 'readdir').mockImplementation(mocks.readdir);
  });

  test('clears cached ready update when the server reports no newer version', async () => {
    const store = createStore();
    const coordinator = new AppUpdateCoordinator(store as never);
    const readyInfo: AppUpdateInfo = {
      latestVersion: '2.0.0',
      releaseDate: '2026-06-10',
      changeLog: [],
      url: 'https://example.com/LZClaw-Setup.exe',
    };
    const readyState: AppUpdateRuntimeState = {
      status: AppUpdateStatus.Ready,
      source: AppUpdateSource.Auto,
      info: readyInfo,
      progress: null,
      readyFilePath: 'C:\\temp\\lzclaw-test\\updates\\lobsterai-update-auto-2.0.0.exe',
      readyFileHash: 'hash-123',
      errorMessage: null,
    };

    store.set('app_update_ready_file:auto', {
      version: readyInfo.latestVersion,
      filePath: readyState.readyFilePath,
      fileHash: readyState.readyFileHash,
      info: readyInfo,
    });
    (coordinator as unknown as { state: AppUpdateRuntimeState }).state = readyState;

    const result = await coordinator.checkNow({ userId: 'user-1' });

    expect(result.success).toBe(true);
    expect(result.updateFound).toBe(false);
    expect(result.state.status).toBe(AppUpdateStatus.Idle);
    expect(result.state.info).toBeNull();
    expect(store.delete).toHaveBeenCalledWith('app_update_ready_file:auto');
    expect(mocks.unlink).toHaveBeenCalledWith(readyState.readyFilePath);
  });
});
