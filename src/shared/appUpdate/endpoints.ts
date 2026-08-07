const CLAW_UPDATE_APP_CODE = 'claw';
const LOCAL_UPDATE_API_BASE_URL = 'http://127.0.0.1:8080';
const PRODUCTION_UPDATE_API_BASE_URL = 'https://zhongtai.srmtj.com';

const AppUpdateRoute = {
  Automatic: 'update',
  Manual: 'update-manual',
} as const;

/**
 * Resolve the LZClaw update endpoint from the build environment.
 * Development builds use the local platform API; packaged builds use the
 * production platform API. Both consume the same published release authority.
 */
export function resolveLzClawUpdateUrl(
  isDevelopment: boolean,
  manual: boolean,
): string {
  const baseUrl = isDevelopment
    ? LOCAL_UPDATE_API_BASE_URL
    : PRODUCTION_UPDATE_API_BASE_URL;
  const route = manual
    ? AppUpdateRoute.Manual
    : AppUpdateRoute.Automatic;

  return `${baseUrl}/api/client-updates/${CLAW_UPDATE_APP_CODE}/${route}`;
}
