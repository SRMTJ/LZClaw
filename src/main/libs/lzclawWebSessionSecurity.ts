import type { Session } from 'electron';

type LzclawWebSession = Pick<
  Session,
  'setPermissionCheckHandler' | 'setPermissionRequestHandler'
>;

export const configureLzclawWebSessionSecurity = (
  targetSession: LzclawWebSession,
): void => {
  targetSession.setPermissionCheckHandler(() => false);
  targetSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
};
