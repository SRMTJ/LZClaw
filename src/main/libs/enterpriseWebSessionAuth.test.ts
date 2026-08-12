import { describe, expect, test, vi } from 'vitest';

import {
  EnterpriseWebSessionValidationStatus,
  isEnterpriseWebSessionReference,
  logoutEnterpriseWebSession,
  recoverEnterpriseWebSession,
  resolveEnterpriseWebSessionReference,
  resolveEnterpriseWebSessionTarget,
  validateEnterpriseWebSession,
} from './enterpriseWebSessionAuth';

const activeAdminContext = {
  entry_type: 'admin',
  csrf_token: 'c'.repeat(32),
  identity: {
    identity_account_id: 'identity-1',
    global_user_id: 'user-1',
    status: 'active',
    version: 1,
  },
  enterprise: {
    tenant_id: 'tenant-1',
    display_name: '海豚买买',
    status: 'active',
    version: 1,
  },
  membership: {
    membership_id: 'membership-1',
    role: 'owner',
    status: 'active',
    version: 1,
  },
  management_access: {
    state: 'granted',
    source: 'enterprise',
  },
};

describe('resolveEnterpriseWebSessionTarget', () => {
  test('resolves only a server-selected entry type for the active environment', () => {
    expect(resolveEnterpriseWebSessionReference('employee', true)).toEqual({
      entryType: 'employee',
      origin: 'https://qiye.srmtj.com',
      profileUrl: 'https://qiye.srmtj.com/employee/api/v1/me',
      logoutUrl: 'https://qiye.srmtj.com/employee/auth/logout',
    });
    expect(resolveEnterpriseWebSessionReference('admin', false)).toMatchObject({
      entryType: 'admin',
      profileUrl: 'https://qiye.srmtj.com/admin/api/v1/me',
    });
  });

  test('recognizes authenticated online portal routes in every build mode', () => {
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/', true)).toMatchObject({
      entryType: 'admin',
      profileUrl: 'https://qiye.srmtj.com/admin/api/v1/me',
    });
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/employee/applications', true)).toMatchObject({
      entryType: 'employee',
      profileUrl: 'https://qiye.srmtj.com/employee/api/v1/me',
    });
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/', false)).toMatchObject({
      entryType: 'admin',
      profileUrl: 'https://qiye.srmtj.com/admin/api/v1/me',
    });
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/employee/applications', false)).toMatchObject({
      entryType: 'employee',
      profileUrl: 'https://qiye.srmtj.com/employee/api/v1/me',
    });
  });

  test('rejects login callbacks, no-entry pages, and lookalike origins', () => {
    expect(resolveEnterpriseWebSessionTarget(
      'https://qiye.srmtj.com/admin/login-result?handoff=ticket',
      true,
    )).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/no-entry', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com.evil.test/admin/', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://user:secret@qiye.srmtj.com/admin/', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/handoff/next', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/login/next', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/no-entry/detail', false)).toBeNull();
  });

  test('rejects local portal origins and accepts online references in every build mode', () => {
    const developmentReference = resolveEnterpriseWebSessionTarget(
      'https://qiye.srmtj.com/admin/',
      true,
    );
    const productionReference = resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/', false);

    expect(resolveEnterpriseWebSessionTarget('http://127.0.0.1:3107/', false)).toBeNull();
    expect(resolveEnterpriseWebSessionTarget('http://127.0.0.1:3107/', true)).toBeNull();
    expect(isEnterpriseWebSessionReference(developmentReference, false)).toBe(true);
    expect(isEnterpriseWebSessionReference(productionReference, true)).toBe(true);
  });
});

describe('enterprise web session recovery', () => {
  test('revalidates the HttpOnly web session and returns only mapped desktop identity data', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(activeAdminContext), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await recoverEnterpriseWebSession({
      navigationUrl: 'https://qiye.srmtj.com/admin/',
      fetch,
      isDevelopment: true,
    });

    expect(result).toEqual({
      status: EnterpriseWebSessionValidationStatus.Authenticated,
      reference: {
        entryType: 'admin',
        origin: 'https://qiye.srmtj.com',
        profileUrl: 'https://qiye.srmtj.com/admin/api/v1/me',
        logoutUrl: 'https://qiye.srmtj.com/admin/auth/logout',
      },
      user: {
        yid: 'user-1',
        userId: 'user-1',
        id: 'identity-1',
        nickname: '海豚买买',
        role: 'owner',
        status: 1,
        entryType: 'admin',
        enterpriseId: 'tenant-1',
        enterpriseName: '海豚买买',
        membershipId: 'membership-1',
      },
    });
    expect(fetch).toHaveBeenCalledWith('https://qiye.srmtj.com/admin/api/v1/me', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(JSON.stringify(result)).not.toContain('csrf_token');
  });

  test('fails closed for inactive or malformed enterprise context', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      ...activeAdminContext,
      membership: { ...activeAdminContext.membership, status: 'disabled' },
    }), { status: 200 }));

    await expect(recoverEnterpriseWebSession({
      navigationUrl: 'https://qiye.srmtj.com/admin/',
      fetch,
      isDevelopment: true,
    })).resolves.toEqual({
      status: EnterpriseWebSessionValidationStatus.Rejected,
    });
  });

  test('distinguishes an expired session from a temporarily unavailable service', async () => {
    const target = resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/', true);
    expect(target).not.toBeNull();

    await expect(validateEnterpriseWebSession({
      reference: target!,
      fetch: vi.fn(async () => new Response(null, { status: 401 })),
      isDevelopment: true,
    })).resolves.toEqual({
      status: EnterpriseWebSessionValidationStatus.Expired,
    });
    await expect(validateEnterpriseWebSession({
      reference: target!,
      fetch: vi.fn(async () => new Response(null, { status: 503 })),
      isDevelopment: true,
    })).resolves.toEqual({
      status: EnterpriseWebSessionValidationStatus.TemporarilyUnavailable,
    });
  });

  test('logs out with a fresh CSRF coordinate without persisting it', async () => {
    const target = resolveEnterpriseWebSessionTarget('https://qiye.srmtj.com/admin/', false);
    expect(target).not.toBeNull();
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(activeAdminContext), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'logged_out' }), { status: 200 }));

    await expect(logoutEnterpriseWebSession({
      reference: target!,
      fetch,
      isDevelopment: false,
    })).resolves.toBe(true);
    expect(fetch).toHaveBeenLastCalledWith('https://qiye.srmtj.com/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'c'.repeat(32),
      },
      body: '{}',
    });
  });
});
