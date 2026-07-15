import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { PluginCredentialStore } from './pluginCredentialStore';

describe('PluginCredentialStore', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-credentials-'));
    filePath = path.join(tmpDir, 'secure', 'credentials.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('stores only encrypted values and decrypts them on demand', () => {
    const store = new PluginCredentialStore(filePath, {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(`protected:${value}`).reverse(),
      decryptString: value => value.reverse().toString('utf8').replace(/^protected:/, ''),
    });

    store.setPluginCredentials('cognee-openclaw', {
      password: 'very-secret-password',
      apiKey: 'cognee-api-key',
    });

    const persisted = fs.readFileSync(filePath, 'utf8');
    expect(persisted).not.toContain('very-secret-password');
    expect(persisted).not.toContain('cognee-api-key');
    expect(store.getPluginCredentials('cognee-openclaw')).toEqual({
      password: 'very-secret-password',
      apiKey: 'cognee-api-key',
    });
    expect(store.getPluginCredentialStatus('cognee-openclaw')).toEqual({
      password: true,
      apiKey: true,
    });
  });

  test('refuses to persist plaintext when platform encryption is unavailable', () => {
    const store = new PluginCredentialStore(filePath, {
      isEncryptionAvailable: () => false,
      encryptString: value => Buffer.from(value),
      decryptString: value => value.toString('utf8'),
    });

    expect(() => store.setPluginCredentials('cognee-openclaw', { password: 'secret' }))
      .toThrow('系统安全凭据存储当前不可用');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
