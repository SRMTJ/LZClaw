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

const isTestMode = () => {
  return configService.getConfig().app?.testMode === true;
};

const getLzServiceEndpoints = () => buildLzServiceEndpoints(
  getLzServiceDefaultBaseUrl({ nodeEnv: process.env.NODE_ENV }),
  isTestMode() ? LZ_SERVICE_ENVIRONMENTS.Test : LZ_SERVICE_ENVIRONMENTS.Prod,
);

// 自动更新
export const getUpdateCheckUrl = () => getLzServiceEndpoints().updateUrl;

// 手动检查更新
export const getManualUpdateCheckUrl = () => getLzServiceEndpoints().manualUpdateUrl;

export const getFallbackDownloadUrl = () => isTestMode()
  ? 'https://lobsterai.inner.youdao.com/#/download-list'
  : 'https://lobsterai.youdao.com/#/download-list';

// Skill 商店
export const getSkillStoreUrl = () => getLzServiceEndpoints().skillStoreUrl;

// Agent 模板
export const getAgentTemplateUrl = () => getLzServiceEndpoints().agentTemplateUrl;

// 登录地址
export const getLoginOvermindUrl = () => getLzServiceEndpoints().loginUrl;

// Portal 页面
const PORTAL_BASE_TEST = 'https://c.youdao.com/dict/hardware/cowork/lobsterai-portal.html#';
const PORTAL_BASE_PROD = 'https://c.youdao.com/dict/hardware/octopus/lobsterai-portal.html#';

const getPortalBase = () => isTestMode() ? PORTAL_BASE_TEST : PORTAL_BASE_PROD;

export const getPortalLoginUrl = () => `${getPortalBase()}/login`;
export const getPortalPricingUrl = () => `${getPortalBase()}/pricing`;
export const getPortalProfileUrl = () => `${getPortalBase()}/profile`;
