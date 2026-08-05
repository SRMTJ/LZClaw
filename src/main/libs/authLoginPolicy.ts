import { resolveAuthLoginPageUrl } from '../../shared/auth/constants';
import { isEnterpriseWebSessionNavigation } from './enterpriseWebSessionAuth';

export const isTrustedAuthLoginNavigation = (
  navigationUrl: string,
  isDevelopment: boolean,
): boolean => {
  try {
    const navigation = new URL(navigationUrl);
    if (navigation.username || navigation.password) return false;
    const loginOrigin = new URL(resolveAuthLoginPageUrl(isDevelopment)).origin;
    return navigation.origin === loginOrigin
      || isEnterpriseWebSessionNavigation(navigationUrl, isDevelopment);
  } catch {
    return false;
  }
};
