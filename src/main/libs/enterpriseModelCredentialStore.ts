import { safeStorage } from 'electron';

import {
  type EnterpriseModelCredential,
  isEnterpriseModelCredential,
} from '../../shared/modelCredential/constants';
import type { SqliteStore } from '../sqliteStore';

const ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY = 'auth_enterprise_model_credential';

type EncryptedEnterpriseModelCredential = {
  version: 1;
  ciphertext: string;
};

let memoryCredential: EnterpriseModelCredential | null = null;

export const saveEnterpriseModelCredential = (
  store: SqliteStore,
  credential: EnterpriseModelCredential,
  isDevelopment: boolean,
): void => {
  if (!isEnterpriseModelCredential(credential, isDevelopment)) {
    throw new Error('Enterprise model credential is invalid');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating system credential encryption is unavailable');
  }
  const ciphertext = safeStorage.encryptString(JSON.stringify(credential)).toString('base64');
  store.set<EncryptedEnterpriseModelCredential>(ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY, {
    version: 1,
    ciphertext,
  });
  memoryCredential = credential;
};

export const getEnterpriseModelCredential = (
  store: SqliteStore,
  isDevelopment: boolean,
): EnterpriseModelCredential | null => {
  if (memoryCredential && isEnterpriseModelCredential(memoryCredential, isDevelopment)) {
    return memoryCredential;
  }
  const encrypted = store.get<EncryptedEnterpriseModelCredential>(
    ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY,
  );
  if (
    encrypted?.version !== 1
    || typeof encrypted.ciphertext !== 'string'
    || !encrypted.ciphertext
    || !safeStorage.isEncryptionAvailable()
  ) {
    if (encrypted !== undefined && encrypted !== null) {
      store.delete(ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY);
    }
    return null;
  }
  try {
    const plaintext = safeStorage.decryptString(Buffer.from(encrypted.ciphertext, 'base64'));
    const credential = JSON.parse(plaintext) as unknown;
    if (!isEnterpriseModelCredential(credential, isDevelopment)) {
      store.delete(ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY);
      return null;
    }
    memoryCredential = credential;
    return credential;
  } catch {
    store.delete(ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY);
    return null;
  }
};

export const clearEnterpriseModelCredential = (store: SqliteStore): void => {
  memoryCredential = null;
  store.delete(ENTERPRISE_MODEL_CREDENTIAL_STORE_KEY);
};
