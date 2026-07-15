import fs from 'fs';
import path from 'path';

export interface PluginCredentialCipher {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface StoredPluginCredentials {
  version: 1;
  plugins: Record<string, Record<string, string>>;
}

const EMPTY_STORE: StoredPluginCredentials = {
  version: 1,
  plugins: {},
};

/**
 * Persists plugin credentials only after the platform credential cipher has
 * encrypted them. The JSON file never contains plaintext secrets.
 */
export class PluginCredentialStore {
  constructor(
    private readonly filePath: string,
    private readonly cipher: PluginCredentialCipher,
  ) {}

  getPluginCredentials(pluginId: string): Record<string, string> {
    const encrypted = this.readStore().plugins[pluginId] ?? {};
    const credentials: Record<string, string> = {};

    for (const [key, value] of Object.entries(encrypted)) {
      try {
        credentials[key] = this.cipher.decryptString(Buffer.from(value, 'base64'));
      } catch (error) {
        console.error(`[PluginCredentialStore] Failed to decrypt ${pluginId}.${key}:`, error);
      }
    }

    return credentials;
  }

  getPluginCredentialStatus(pluginId: string): Record<string, boolean> {
    return Object.fromEntries(
      Object.keys(this.readStore().plugins[pluginId] ?? {}).map(key => [key, true]),
    );
  }

  setPluginCredentials(pluginId: string, credentials: Record<string, string>): void {
    const entries = Object.entries(credentials).filter(([, value]) => value.length > 0);
    if (entries.length === 0) return;
    if (!this.cipher.isEncryptionAvailable()) {
      throw new Error('系统安全凭据存储当前不可用，未保存 Cognee 凭据');
    }

    const store = this.readStore();
    const pluginCredentials = { ...(store.plugins[pluginId] ?? {}) };
    for (const [key, value] of entries) {
      pluginCredentials[key] = this.cipher.encryptString(value).toString('base64');
    }
    store.plugins[pluginId] = pluginCredentials;
    this.writeStore(store);
  }

  private readStore(): StoredPluginCredentials {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<StoredPluginCredentials>;
      if (parsed.version === 1 && parsed.plugins && typeof parsed.plugins === 'object') {
        return { version: 1, plugins: parsed.plugins };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[PluginCredentialStore] Failed to read credential store:', error);
      }
    }
    return { version: EMPTY_STORE.version, plugins: {} };
  }

  private writeStore(store: StoredPluginCredentials): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tempPath, this.filePath);
  }
}
