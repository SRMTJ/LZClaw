interface PersistentAuthWebSession {
  clearStorageData: (options: { origin: string }) => Promise<void>;
  cookies: {
    flushStore: () => Promise<void>;
    remove: (url: string, name: string) => Promise<void>;
  };
}

const uniqueOrigins = (origins: readonly string[]): string[] => [...new Set(origins)];

export const clearNativeAuthWebSessionCredentials = async (
  webSession: PersistentAuthWebSession,
  origins: readonly string[],
  cookieName: string,
): Promise<void> => {
  await Promise.all(uniqueOrigins(origins).map(origin => (
    webSession.cookies.remove(`${origin}/`, cookieName)
  )));
  await webSession.cookies.flushStore();
};

export const clearEnterpriseAuthWebSessionCredentials = async (
  webSession: PersistentAuthWebSession,
  origins: readonly string[],
): Promise<void> => {
  await Promise.all(uniqueOrigins(origins).map(origin => (
    webSession.clearStorageData({ origin })
  )));
  await webSession.cookies.flushStore();
};
