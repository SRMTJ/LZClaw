import { ipcMain } from 'electron';

import {
  BusinessCenterIpcChannel,
  type BusinessCenterOpenRequest,
  type BusinessCenterVisibilityRequest,
} from '../../../shared/businessCenter/constants';
import type { BusinessCenterInAppViewController } from '../../libs/businessCenterInAppView';

interface RegisterBusinessCenterIpcHandlersOptions {
  getController: () => BusinessCenterInAppViewController;
}

export const registerBusinessCenterIpcHandlers = (
  options: RegisterBusinessCenterIpcHandlersOptions,
): void => {
  ipcMain.handle(
    BusinessCenterIpcChannel.Open,
    async (_event, request: BusinessCenterOpenRequest) => {
      try {
        await options.getController().open(request.bounds);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error
            ? error.message
            : 'Failed to open business center',
        };
      }
    },
  );

  ipcMain.handle(
    BusinessCenterIpcChannel.UpdateBounds,
    (_event, request: BusinessCenterOpenRequest) => ({
      success: options.getController().updateBounds(request.bounds),
    }),
  );

  ipcMain.handle(
    BusinessCenterIpcChannel.SetVisible,
    (_event, request: BusinessCenterVisibilityRequest) => ({
      success: options.getController().setVisible(request.visible),
    }),
  );

  ipcMain.handle(BusinessCenterIpcChannel.Reload, async () => {
    try {
      return { success: await options.getController().reload() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to reload business center',
      };
    }
  });
};
