import type { CoworkStore } from '../coworkStore';
import type { PluginCredentialStore } from './pluginCredentialStore';

export const COGNEE_PLUGIN_ID = 'cognee-openclaw';
export const COGNEE_PLUGIN_PACKAGE = '@cognee/cognee-openclaw';
export const COGNEE_PLUGIN_VERSION = '2026.6.11';
export const COGNEE_API_KEY_ENV = 'COGNEE_API_KEY';
export const COGNEE_PASSWORD_ENV = 'COGNEE_PASSWORD';

export const DEFAULT_COGNEE_CONFIG: Record<string, unknown> = {
  mode: 'local',
  credentialMode: 'password',
  baseUrl: 'http://127.0.0.1:8000',
  datasetName: 'lzclaw',
  agentDatasetPrefix: 'lzclaw-agent',
  recallScopes: ['agent'],
  defaultWriteScope: 'agent',
  enableSessions: true,
  persistSessionsAfterEnd: true,
  searchType: 'FEELING_LUCKY',
  autoRecall: true,
  autoIndex: true,
  autoCognify: true,
};

export const COGNEE_FALLBACK_SCHEMA = {
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: ['local', 'cloud'], description: '本地自托管或 Cognee Cloud。' },
      credentialMode: { type: 'string', enum: ['password', 'apiKey'], description: '选择用户名密码或 API Key 认证。' },
      baseUrl: { type: 'string', description: 'Cognee API 地址。Docker 本机部署通常为 http://127.0.0.1:8000。' },
      apiKey: { type: 'string', description: '可选。保存后由系统安全存储加密，不写入 SQLite 或 openclaw.json。' },
      username: { type: 'string', description: 'Cognee 登录用户名。' },
      password: { type: 'string', description: '保存后由系统安全存储加密，不写入 SQLite 或 openclaw.json。' },
      datasetName: { type: 'string', description: '单作用域模式的数据集名称。' },
      companyDataset: { type: 'string', description: '可选的企业共享数据集。填写后启用多作用域模式。' },
      userDatasetPrefix: { type: 'string', description: '可选的用户数据集前缀。' },
      agentDatasetPrefix: { type: 'string', description: '智能体数据集前缀，实际名称会附加 agentId。' },
      recallScopes: { type: 'array', items: { type: 'string', enum: ['company', 'user', 'agent'] } },
      defaultWriteScope: { type: 'string', enum: ['company', 'user', 'agent'] },
      enableSessions: { type: 'boolean' },
      persistSessionsAfterEnd: { type: 'boolean' },
      searchType: {
        type: 'string',
        enum: [
          'GRAPH_COMPLETION', 'GRAPH_COMPLETION_COT', 'GRAPH_COMPLETION_CONTEXT_EXTENSION',
          'GRAPH_SUMMARY_COMPLETION', 'RAG_COMPLETION', 'TRIPLET_COMPLETION', 'CHUNKS',
          'CHUNKS_LEXICAL', 'SUMMARIES', 'CYPHER', 'NATURAL_LANGUAGE', 'TEMPORAL',
          'CODING_RULES', 'FEELING_LUCKY',
        ],
      },
      maxResults: { type: 'number' },
      maxTokens: { type: 'number' },
      autoRecall: { type: 'boolean' },
      autoIndex: { type: 'boolean' },
      autoCognify: { type: 'boolean' },
      requestTimeoutMs: { type: 'number' },
    },
  },
  uiHints: {
    mode: { label: '运行模式', order: 1 },
    credentialMode: { label: '认证方式', order: 2 },
    baseUrl: { label: 'Cognee API 地址', placeholder: 'http://127.0.0.1:8000', order: 3 },
    apiKey: { label: 'API Key', sensitive: true, order: 4 },
    username: { label: '用户名', placeholder: 'admin@example.com', order: 5 },
    password: { label: '密码', sensitive: true, order: 6 },
    datasetName: { label: '默认数据集', placeholder: 'lzclaw', order: 10 },
    companyDataset: { label: '企业共享数据集', order: 11 },
    userDatasetPrefix: { label: '用户数据集前缀', order: 12 },
    agentDatasetPrefix: { label: '智能体数据集前缀', placeholder: 'lzclaw-agent', order: 13 },
    recallScopes: { label: '检索作用域', order: 14 },
    defaultWriteScope: { label: '默认写入作用域', order: 15 },
    enableSessions: { label: '启用会话记忆', order: 20 },
    persistSessionsAfterEnd: { label: '会话结束后持久化', order: 21 },
    searchType: { label: '搜索模式', order: 22 },
    maxResults: { label: '最大召回条数', order: 23 },
    maxTokens: { label: '最大召回 Token', order: 24 },
    autoRecall: { label: '自动召回', order: 30 },
    autoIndex: { label: '启动时自动索引', order: 31 },
    autoCognify: { label: '自动 Cognify', order: 32 },
    requestTimeoutMs: { label: '请求超时（毫秒）', order: 40 },
  },
};

export interface CogneeConnectionTestResult {
  ok: boolean;
  reachable: boolean;
  authenticated: boolean;
  message: string;
  version?: string;
  user?: string;
}

export function ensureCogneePluginRegistration(store: CoworkStore): void {
  if (store.getUserPlugin(COGNEE_PLUGIN_ID)) return;
  store.addUserPlugin({
    pluginId: COGNEE_PLUGIN_ID,
    source: 'npm',
    spec: COGNEE_PLUGIN_PACKAGE,
    version: COGNEE_PLUGIN_VERSION,
    enabled: false,
    installedAt: Date.now(),
  });
  store.setUserPluginConfig(COGNEE_PLUGIN_ID, DEFAULT_COGNEE_CONFIG);
}

export function saveCogneePluginConfig(
  store: CoworkStore,
  credentialStore: PluginCredentialStore,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const publicConfig = { ...config };
  const credentials: Record<string, string> = {};
  for (const key of ['apiKey', 'password']) {
    const value = publicConfig[key];
    if (typeof value === 'string' && value.length > 0) credentials[key] = value;
    delete publicConfig[key];
  }
  credentialStore.setPluginCredentials(COGNEE_PLUGIN_ID, credentials);
  store.setUserPluginConfig(COGNEE_PLUGIN_ID, publicConfig);
  return publicConfig;
}

export function getSanitizedCogneeConfig(
  store: CoworkStore,
  credentialStore: PluginCredentialStore,
): Record<string, unknown> {
  const config = {
    ...DEFAULT_COGNEE_CONFIG,
    ...(store.getUserPluginConfig(COGNEE_PLUGIN_ID) ?? {}),
  };
  if (typeof config.apiKey === 'string' || typeof config.password === 'string') {
    return saveCogneePluginConfig(store, credentialStore, config);
  }
  return config;
}

export function buildCogneeOpenClawConfig(
  config: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const publicConfig = { ...DEFAULT_COGNEE_CONFIG, ...(config ?? {}) };
  const credentialMode = publicConfig.credentialMode === 'apiKey' ? 'apiKey' : 'password';
  delete publicConfig.credentialMode;
  delete publicConfig.apiKey;
  delete publicConfig.password;

  if (credentialMode === 'apiKey') {
    publicConfig.apiKey = `\${${COGNEE_API_KEY_ENV}}`;
  } else {
    // Explicitly inject a non-default password placeholder. If the user has
    // not configured a credential yet, the gateway receives "unconfigured"
    // instead of silently trying Cognee's documented default password.
    publicConfig.password = `\${${COGNEE_PASSWORD_ENV}}`;
  }
  return publicConfig;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function readResponseMessage(response: Response): Promise<string> {
  try {
    const body = await response.clone().json() as Record<string, unknown>;
    return stringValue(body.detail) || stringValue(body.message) || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function testCogneeConnection(
  draftConfig: Record<string, unknown>,
  storedCredentials: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<CogneeConnectionTestResult> {
  const baseUrl = stringValue(draftConfig.baseUrl || DEFAULT_COGNEE_CONFIG.baseUrl).replace(/\/+$/, '');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('unsupported protocol');
  } catch {
    return { ok: false, reachable: false, authenticated: false, message: 'Cognee API 地址无效' };
  }

  const credentialMode = draftConfig.credentialMode === 'apiKey' ? 'apiKey' : 'password';
  const apiKey = credentialMode === 'apiKey'
    ? (stringValue(draftConfig.apiKey) || storedCredentials.apiKey || '')
    : '';
  const username = stringValue(draftConfig.username);
  const password = credentialMode === 'password'
    ? (stringValue(draftConfig.password) || storedCredentials.password || '')
    : '';
  const timeoutMs = Number(draftConfig.requestTimeoutMs) || 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1_000), 60_000));

  try {
    const authHeaders: Record<string, string> = {};
    if (apiKey) {
      authHeaders.Authorization = `Bearer ${apiKey}`;
      authHeaders['X-Api-Key'] = apiKey;
    }
    const healthResponse = await fetchImpl(`${baseUrl}/health`, {
      headers: authHeaders,
      signal: controller.signal,
    });
    if (!healthResponse.ok) {
      return {
        ok: false,
        reachable: true,
        authenticated: false,
        message: `Cognee 健康检查失败：${await readResponseMessage(healthResponse)}`,
      };
    }
    const health = await healthResponse.json().catch(() => ({})) as Record<string, unknown>;
    const version = stringValue(health.version) || undefined;

    let accessToken = apiKey;
    if (!apiKey) {
      if (!username || !password) {
        return {
          ok: false,
          reachable: true,
          authenticated: false,
          message: 'Cognee 服务可访问，请填写用户名和密码或 API Key',
          version,
        };
      }
      const loginResponse = await fetchImpl(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }).toString(),
        signal: controller.signal,
      });
      if (!loginResponse.ok) {
        return {
          ok: false,
          reachable: true,
          authenticated: false,
          message: `Cognee 登录失败：${await readResponseMessage(loginResponse)}`,
          version,
        };
      }
      const login = await loginResponse.json() as Record<string, unknown>;
      accessToken = stringValue(login.access_token) || stringValue(login.token);
      if (!accessToken) {
        return { ok: false, reachable: true, authenticated: false, message: 'Cognee 登录响应缺少访问令牌', version };
      }
    }

    const meResponse = await fetchImpl(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      signal: controller.signal,
    });
    if (!meResponse.ok) {
      return {
        ok: false,
        reachable: true,
        authenticated: false,
        message: `Cognee 凭据验证失败：${await readResponseMessage(meResponse)}`,
        version,
      };
    }
    const me = await meResponse.json().catch(() => ({})) as Record<string, unknown>;
    const user = stringValue(me.email) || stringValue(me.username) || username || undefined;
    return { ok: true, reachable: true, authenticated: true, message: 'Cognee 连接和凭据验证成功', version, user };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? '连接 Cognee 超时'
      : `无法连接 Cognee：${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, reachable: false, authenticated: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
