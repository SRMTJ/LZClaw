import { describe, expect, test } from 'vitest';

import { PlatformRegistry, RetiredIMPlatform } from './constants';

describe('PlatformRegistry product configuration', () => {
  const retiredPlatforms = Object.values(RetiredIMPlatform);

  test('keeps retired platforms available for legacy data lookup', () => {
    expect(PlatformRegistry.platforms).toEqual(expect.arrayContaining(retiredPlatforms));
    expect(PlatformRegistry.platformOfChannel('clawemail-email')).toBe('email');
    expect(PlatformRegistry.platformOfChannel('moltbot-popo')).toBe('popo');
  });

  test('excludes retired platforms from product configuration', () => {
    expect(PlatformRegistry.configurablePlatforms).not.toEqual(
      expect.arrayContaining(retiredPlatforms),
    );

    const configurableChannels = PlatformRegistry.configurableChannelOptions()
      .map(option => option.value);
    expect(configurableChannels).not.toEqual(expect.arrayContaining([
      'nim',
      'netease-bee',
      'moltbot-popo',
      'email',
    ]));
  });
});
