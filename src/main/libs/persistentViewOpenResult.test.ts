import { describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistentViewOpenStatus: {
    Opened: 'opened',
    Superseded: 'superseded',
    Closed: 'closed',
  },
}));

vi.mock('@fudanda/electron-persistent-view', () => ({
  PersistentViewOpenStatus: mocks.persistentViewOpenStatus,
}));

import { isPersistentViewOpened } from './persistentViewOpenResult';

describe('isPersistentViewOpened', () => {
  test('accepts only a completed open result', () => {
    expect(isPersistentViewOpened({
      status: mocks.persistentViewOpenStatus.Opened,
    })).toBe(true);
    expect(isPersistentViewOpened({
      status: mocks.persistentViewOpenStatus.Superseded,
    })).toBe(false);
    expect(isPersistentViewOpened({
      status: mocks.persistentViewOpenStatus.Closed,
    })).toBe(false);
  });
});
