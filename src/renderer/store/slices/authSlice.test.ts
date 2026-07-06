import { describe, expect, it } from 'vitest';

import authReducer, {
  setLoggedIn,
  setLoggedOut,
  type UserProfile,
  type UserQuota,
  type WorkstationWorkspace,
} from './authSlice';

const user: UserProfile = {
  yid: 'enterprise-user-1',
  nickname: 'Alice',
  avatarUrl: null,
  userId: 'enterprise-user-1',
  status: 1,
};

const quota: UserQuota = {
  planName: 'Enterprise',
  subscriptionStatus: 'active',
  creditsLimit: 1000,
  creditsUsed: 100,
  creditsRemaining: 900,
  hasPaidCredits: true,
};

const workspace: WorkstationWorkspace = {
  id: 'enterprise-1',
  name: 'Acme One',
  code: 'acme-one',
  role: 'owner',
  status: 'active',
};

const workspaces: WorkstationWorkspace[] = [
  workspace,
  {
    id: 'enterprise-2',
    name: 'Acme Two',
    code: 'acme-two',
    role: 'employee',
    status: 'active',
  },
];

describe('authSlice workspace state', () => {
  it('stores workspace data on login and clears it on logout', () => {
    const loggedIn = authReducer(undefined, setLoggedIn({
      user,
      quota,
      workspace,
      workspaces,
    }));

    expect(loggedIn.isLoggedIn).toBe(true);
    expect(loggedIn.workspace).toEqual(workspace);
    expect(loggedIn.workspaces).toEqual(workspaces);

    const loggedOut = authReducer(loggedIn, setLoggedOut());

    expect(loggedOut.isLoggedIn).toBe(false);
    expect(loggedOut.workspace).toBeNull();
    expect(loggedOut.workspaces).toEqual([]);
  });
});
