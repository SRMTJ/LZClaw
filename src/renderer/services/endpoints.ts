/**
 * 集中管理所有业务 API 端点。
 * 后续新增的业务接口也应在此文件中配置。
 */

import {
  buildLzServiceEndpoints,
  getLzServiceDefaultBaseUrl,
  LZ_SERVICE_ENVIRONMENTS,
} from '../../shared/lzServiceConfig';
import { configService } from './config';

export const isTestModeEnabled = () => {
  return configService.getConfig().app?.testMode === true;
};

const getLzServiceEndpoints = () => buildLzServiceEndpoints(
  getLzServiceDefaultBaseUrl({ nodeEnv: process.env.NODE_ENV }),
  isTestModeEnabled() ? LZ_SERVICE_ENVIRONMENTS.Test : LZ_SERVICE_ENVIRONMENTS.Prod,
);

// 自动更新
export const getUpdateCheckUrl = () => getLzServiceEndpoints().updateUrl;

// 手动检查更新
export const getManualUpdateCheckUrl = () => getLzServiceEndpoints().manualUpdateUrl;

export const getFallbackDownloadUrl = () => isTestModeEnabled()
  ? 'https://lobsterai.inner.youdao.com/#/download-list'
  : 'https://lobsterai.youdao.com/#/download-list';

// Skill 商店
export const getSkillStoreUrl = () => getLzServiceEndpoints().skillStoreUrl;

// Agent 模板
export const getAgentTemplateUrl = () => getLzServiceEndpoints().agentTemplateUrl;

// Kit 商店
export const getKitStoreUrl = () => isTestModeEnabled()
  ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/test/kit-store'
  : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/lobsterai/prod/kit-store';

// 登录地址
export const getLoginOvermindUrl = () => getLzServiceEndpoints().loginUrl;

// Portal 页面
const PORTAL_BASE_TEST = 'https://lobsterai.inner.youdao.com/portal#';
const PORTAL_BASE_PROD = 'https://lobsterai.youdao.com/portal#';

const getPortalBase = () => isTestModeEnabled() ? PORTAL_BASE_TEST : PORTAL_BASE_PROD;

export const PortalPricingKeyfrom = {
  HtmlShare: 'html_share',
} as const;

export type PortalPricingKeyfrom =
  (typeof PortalPricingKeyfrom)[keyof typeof PortalPricingKeyfrom];

export const getPortalLoginUrl = () => `${getPortalBase()}/login`;
export const getPortalPricingUrl = (keyfrom?: PortalPricingKeyfrom) => (
  `${getPortalBase()}/pricing${keyfrom ? `?keyfrom=${encodeURIComponent(keyfrom)}` : ''}`
);
export const getPortalProfileUrl = () => `${getPortalBase()}/profile`;
export const getPortalRechargeUrl = () => `${getPortalBase()}/`;
export const getPortalInvitationUrl = () => `${getPortalBase()}/invitation`;
export const getPortalCreditsResetActivityUrl = () => `${getPortalBase()}/profile?activity=credits_reset`;
