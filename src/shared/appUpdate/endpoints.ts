const LZCLAW_UPDATE_APP_CODE = 'lzclaw';
const LOCAL_UPDATE_API_BASE_URL = 'http://127.0.0.1:8080';
const PRODUCTION_UPDATE_API_BASE_URL = 'https://zhongtai.srmtj.com';

const AppUpdateChannel = {
  Test: 'test',
  Production: 'prod',
} as const;

const AppUpdateRoute = {
  Automatic: 'update',
  Manual: 'update-manual',
} as const;

/**
 * Resolve the LZClaw update endpoint from the build environment.
 * Development builds always use the local platform API and test channel;
 * packaged builds always use the production platform API and prod channel.
 */
export function resolveLzClawUpdateUrl(
  isDevelopment: boolean,
  manual: boolean,
): string {
  const baseUrl = isDevelopment
    ? LOCAL_UPDATE_API_BASE_URL
    : PRODUCTION_UPDATE_API_BASE_URL;
  const channel = isDevelopment
    ? AppUpdateChannel.Test
    : AppUpdateChannel.Production;
  const route = manual
    ? AppUpdateRoute.Manual
    : AppUpdateRoute.Automatic;

  return `${baseUrl}/api/client-updates/${LZCLAW_UPDATE_APP_CODE}/${channel}/${route}`;
}
