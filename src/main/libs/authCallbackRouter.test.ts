import { describe, expect, test } from 'vitest';

import { AuthIpcChannel } from '../../shared/auth/constants';
import { AuthCallbackRouter, type AuthCallbackTarget } from './authCallbackRouter';

function createTarget(): {
  target: AuthCallbackTarget;
  sent: Array<{ channel: string; payload: { code: string } }>;
} {
  const sent: Array<{ channel: string; payload: { code: string } }> = [];
  return {
    sent,
    target: {
      isDestroyed: () => false,
      send: (channel, payload) => {
        sent.push({ channel, payload });
      },
    },
  };
}

describe('AuthCallbackRouter', () => {
  test('sends callback immediately when renderer listener is ready', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    expect(router.markListenerReadyAndConsumePending()).toBeNull();
    router.handleDeepLink('lobsterai://auth/callback?code=ready-code');

    expect(sent).toEqual([
      { channel: AuthIpcChannel.Callback, payload: { code: 'ready-code' } },
    ]);
  });

  test('buffers callback until renderer listener becomes ready', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    router.handleDeepLink('lobsterai://auth/callback?code=pending-code');

    expect(sent).toEqual([]);
    expect(router.markListenerReadyAndConsumePending()).toBe('pending-code');
    expect(router.markListenerReadyAndConsumePending()).toBeNull();
  });

  test('state-verified loopback auth code delivery uses the ready listener path', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    router.markListenerReadyAndConsumePending();
    router.handleVerifiedLoopbackAuthCode('local-code');

    expect(sent).toEqual([
      { channel: AuthIpcChannel.Callback, payload: { code: 'local-code' } },
    ]);
  });

  test('state-verified loopback auth code buffers before renderer listener is ready', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    router.handleVerifiedLoopbackAuthCode('local-pending-code');

    expect(sent).toEqual([]);
    expect(router.markListenerReadyAndConsumePending()).toBe('local-pending-code');
  });

  test('accepts enterprise codes only from the state-verified loopback callback', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });
    const enterpriseCode = `ent_${'a'.repeat(43)}`;

    router.markListenerReadyAndConsumePending();
    router.handleVerifiedLoopbackAuthCode(enterpriseCode);

    expect(sent).toEqual([
      { channel: AuthIpcChannel.Callback, payload: { code: enterpriseCode } },
    ]);
  });

  test('rejects enterprise codes injected through the legacy deep-link protocol', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    router.markListenerReadyAndConsumePending();
    router.handleDeepLink(`lobsterai://auth/callback?code=ent_${'a'.repeat(43)}`);

    expect(sent).toEqual([]);
    expect(router.markListenerReadyAndConsumePending()).toBeNull();
  });

  test('keeps renderer listener ready for child frame artifact loads', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    router.markListenerReadyAndConsumePending();
    router.handleNavigationStarted({ isMainFrame: false, isInPlace: false });
    router.handleDeepLink('lobsterai://auth/callback?code=iframe-code');

    expect(sent).toEqual([
      { channel: AuthIpcChannel.Callback, payload: { code: 'iframe-code' } },
    ]);
  });

  test('marks renderer unavailable for main frame document navigation', () => {
    const { target, sent } = createTarget();
    const router = new AuthCallbackRouter({ getTarget: () => target });

    router.markListenerReadyAndConsumePending();
    router.handleNavigationStarted({ isMainFrame: true, isInPlace: false });
    router.handleDeepLink('lobsterai://auth/callback?code=reload-code');

    expect(sent).toEqual([]);
    expect(router.markListenerReadyAndConsumePending()).toBe('reload-code');
  });
});
