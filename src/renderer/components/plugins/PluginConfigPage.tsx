import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useCallback,useEffect, useState } from 'react';

import { i18nService } from '../../services/i18n';
import { SchemaForm } from '../im/SchemaForm';

interface PluginConfigPageProps {
  pluginId: string;
  onBack: () => void;
  initialConfig?: Record<string, unknown>;
  onConfigChange: (pluginId: string, config: Record<string, unknown>) => void;
  onConfigLoaded: (pluginId: string, config: Record<string, unknown>) => void;
}

interface ConfigSchemaData {
  configSchema: Record<string, unknown>;
  uiHints: Record<string, {
    label?: string;
    help?: string;
    sensitive?: boolean;
    advanced?: boolean;
    placeholder?: string;
    order?: number;
  }>;
}

/** Deep-set a value in nested object by dot path, returning a new object */
function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const existing = current[key];
    current[key] = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (value === '' || value === undefined) {
    delete current[lastKey];
  } else {
    current[lastKey] = value;
  }

  return result;
}

export default function PluginConfigPage({ pluginId, onBack, initialConfig, onConfigChange, onConfigLoaded }: PluginConfigPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<ConfigSchemaData | null>(null);
  const [configValue, setConfigValue] = useState<Record<string, unknown>>(initialConfig ?? {});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    ok: boolean;
    message: string;
    version?: string;
    user?: string;
  } | null>(null);

  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron?.plugins.getConfigSchema(pluginId);
      if (result?.success && result.schema) {
        setSchema(result.schema);
        const loadedConfig = result.config ?? {};
        setSecretStatus(result.secretStatus ?? {});
        // If parent already has a pending config for this plugin, use that instead
        if (!initialConfig) {
          setConfigValue(loadedConfig);
        }
        // Notify parent about the initial config from backend
        onConfigLoaded(pluginId, loadedConfig);
      } else {
        setError(result?.error || i18nService.t('pluginsConfigLoadError'));
      }
    } catch {
      setError(i18nService.t('pluginsConfigLoadError'));
    }
    setLoading(false);
  }, [pluginId, initialConfig, onConfigLoaded]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const handleChange = (path: string, value: unknown) => {
    const next = deepSet(configValue, path, value);
    setConfigValue(next);
    onConfigChange(pluginId, next);
  };

  const handleToggleSecret = (path: string) => {
    setShowSecrets(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const result = await window.electron?.plugins.testConnection(pluginId, configValue);
      setConnectionResult(result ?? { ok: false, message: i18nService.t('pluginsCogneeTestFailed') });
    } catch {
      setConnectionResult({ ok: false, message: i18nService.t('pluginsCogneeTestFailed') });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6 px-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {i18nService.t('pluginsConfigTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">{pluginId}</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : error ? (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
          {error}
        </div>
      ) : !schema ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {i18nService.t('pluginsConfigNoSchema')}
        </div>
      ) : (
        <div className="space-y-4">
          {pluginId === 'cognee-openclaw' && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-secondary">
              <p>{i18nService.t('pluginsCogneeCredentialSecureHint')}</p>
              {(secretStatus.apiKey || secretStatus.password) && (
                <p className="mt-1 font-medium text-primary">
                  {i18nService.t('pluginsCogneeCredentialStored')}
                  {secretStatus.apiKey ? ' API Key' : ''}
                  {secretStatus.password ? ' Password' : ''}
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border p-4">
            <SchemaForm
              schema={schema.configSchema}
              hints={schema.uiHints as Record<string, import('../im/SchemaForm').UiHint>}
              value={configValue}
              onChange={handleChange}
              showSecrets={showSecrets}
              onToggleSecret={handleToggleSecret}
              includePath={(path) => {
                if (pluginId !== 'cognee-openclaw') return true;
                const credentialMode = configValue.credentialMode === 'apiKey' ? 'apiKey' : 'password';
                if (credentialMode === 'apiKey') return path !== 'username' && path !== 'password';
                return path !== 'apiKey';
              }}
            />
          </div>

          {pluginId === 'cognee-openclaw' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              >
                {testingConnection
                  ? i18nService.t('pluginsCogneeTesting')
                  : i18nService.t('pluginsCogneeTestConnection')}
              </button>
              {connectionResult && (
                <div className={`rounded-lg border p-3 text-sm ${
                  connectionResult.ok
                    ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}>
                  <p>{connectionResult.message}</p>
                  {connectionResult.ok && (connectionResult.version || connectionResult.user) && (
                    <p className="mt-1 text-xs opacity-80">
                      {[connectionResult.version, connectionResult.user].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
