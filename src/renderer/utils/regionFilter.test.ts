import { RetiredIMPlatform } from '@shared/platform';
import { describe, expect, test } from 'vitest';

import { getVisibleIMPlatforms } from './regionFilter';

describe('getVisibleIMPlatforms', () => {
  test.each(['zh', 'en'] as const)('hides retired IM platforms for %s', language => {
    const platforms = getVisibleIMPlatforms(language);

    expect(platforms).not.toEqual(
      expect.arrayContaining(Object.values(RetiredIMPlatform)),
    );
  });

  test('preserves region filtering for supported platforms', () => {
    expect(getVisibleIMPlatforms('zh')).toContain('weixin');
    expect(getVisibleIMPlatforms('zh')).not.toContain('telegram');
    expect(getVisibleIMPlatforms('en')).toContain('telegram');
  });
});
