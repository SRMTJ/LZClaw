import { app, safeStorage } from 'electron';
import path from 'path';

import { PluginCredentialStore } from './pluginCredentialStore';

export function createElectronPluginCredentialStore(): PluginCredentialStore {
  return new PluginCredentialStore(
    path.join(app.getPath('userData'), 'secure', 'plugin-credentials.json'),
    {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: value => safeStorage.encryptString(value),
      decryptString: value => safeStorage.decryptString(value),
    },
  );
}
