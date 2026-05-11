import type { Platform } from './platform';

export const LZ_VISIBLE_IM_PLATFORMS = [
  'weixin',
  'dingtalk',
  'feishu',
  'wecom',
] as const satisfies readonly Platform[];

const LZ_VISIBLE_IM_PLATFORM_SET = new Set<string>(LZ_VISIBLE_IM_PLATFORMS);

export const isLzVisibleIMPlatform = (platform: Platform): boolean =>
  LZ_VISIBLE_IM_PLATFORM_SET.has(platform);
