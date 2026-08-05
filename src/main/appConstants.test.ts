import { describe, expect, test } from 'vitest';

import { APP_DATA_DIR_NAME, APP_NAME, APP_USER_MODEL_ID } from './appConstants';

describe('application brand constants', () => {
  test('uses the new display brand without moving existing user data', () => {
    expect(APP_NAME).toBe('海豚买买AI工作台');
    expect(APP_DATA_DIR_NAME).toBe('LobsterAI');
    expect(APP_USER_MODEL_ID).toBe('com.lobsterai.app');
  });
});
