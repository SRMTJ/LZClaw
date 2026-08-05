import type { Platform } from '@shared/platform';
import { PlatformRegistry } from '@shared/platform';

/**
 * 根据语言获取可见的 IM 平台
 */
export const getVisibleIMPlatforms = (language: 'zh' | 'en'): readonly Platform[] => {
  if (language === 'zh') {
    return PlatformRegistry.configurablePlatformsByRegion('china');
  }
  return PlatformRegistry.configurablePlatforms;
};
