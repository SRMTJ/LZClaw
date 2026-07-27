import type { Session } from 'electron';
import { describe, expect, test, vi } from 'vitest';

import { configureLzclawWebSessionSecurity } from './lzclawWebSessionSecurity';

type PermissionCheckHandler = Exclude<
  Parameters<Session['setPermissionCheckHandler']>[0],
  null
>;
type PermissionRequestHandler = Exclude<
  Parameters<Session['setPermissionRequestHandler']>[0],
  null
>;

describe('configureLzclawWebSessionSecurity', () => {
  test('denies permission checks and requests by default', () => {
    const setPermissionCheckHandler = vi.fn();
    const setPermissionRequestHandler = vi.fn();
    configureLzclawWebSessionSecurity({
      setPermissionCheckHandler,
      setPermissionRequestHandler,
    } as never);

    const checkHandler = setPermissionCheckHandler.mock.calls[0][0] as
      PermissionCheckHandler;
    expect(checkHandler(
      {} as never,
      'media',
      'https://example.test',
      {} as never,
    )).toBe(false);

    const requestHandler = setPermissionRequestHandler.mock.calls[0][0] as
      PermissionRequestHandler;
    const callback = vi.fn();
    requestHandler(
      {} as never,
      'media',
      callback,
      {} as never,
    );
    expect(callback).toHaveBeenCalledWith(false);
  });
});
