import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../store', () => ({
  store: {
    getState: () => ({
      auth: {
        user: {
          yid: 'stored-user',
        },
      },
    }),
  },
}));

import {
  buildLogUrl,
  LogReporterAction,
  LogReporterActionPrefix,
  LogReporterCategory,
  LogReporterEndpoint,
  LogReporterEntry,
  LogReporterProduct,
  reportYdAnalyzer,
} from './logReporter';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('builds a Youdao Analyzer URL with common and event parameters', () => {
  const result = new URL(buildLogUrl(
    {
      action: `${LogReporterActionPrefix.LobsterAI}skill_enabled`,
      skillId: 'xlsx',
      enabled: true,
    },
    {
      userId: 'test-user',
      timestamp: 123456789,
    },
  ));

  expect(result.origin + result.pathname).toBe(LogReporterEndpoint.YoudaoAnalyzer);
  expect(result.searchParams.get('_npid')).toBe(LogReporterProduct.LobsterAI);
  expect(result.searchParams.get('_ncat')).toBe(LogReporterCategory.Event);
  expect(result.searchParams.get('action')).toBe('lobsterai_skill_enabled');
  expect(result.searchParams.get('skillId')).toBe('xlsx');
  expect(result.searchParams.get('enabled')).toBe('true');
  expect(result.searchParams.get('log_Usid')).toBe('test-user');
  expect(result.searchParams.get('uts')).toBe('123456789');
});

test('does not allow event parameters to override common parameters', () => {
  const result = new URL(buildLogUrl(
    {
      action: 'lobsterai_app_started',
      _npid: 'unexpected-product',
      _ncat: 'unexpected-category',
      log_Usid: 'unexpected-user',
      uts: 1,
    },
    {
      userId: 'trusted-user',
      timestamp: 2,
    },
  ));

  expect(result.searchParams.get('_npid')).toBe(LogReporterProduct.LobsterAI);
  expect(result.searchParams.get('_ncat')).toBe(LogReporterCategory.Event);
  expect(result.searchParams.get('log_Usid')).toBe('trusted-user');
  expect(result.searchParams.get('uts')).toBe('2');
});

test('uses the logged-in user and omits empty optional parameters', () => {
  const result = new URL(buildLogUrl(
    {
      action: `${LogReporterActionPrefix.LobsterAI}app_started`,
      optionalValue: undefined,
      nullableValue: null,
    },
    {
      timestamp: 987654321,
    },
  ));

  expect(result.searchParams.get('log_Usid')).toBe('stored-user');
  expect(result.searchParams.has('optionalValue')).toBe(false);
  expect(result.searchParams.has('nullableValue')).toBe(false);
});

test('reports an event through the Electron API bridge', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: fetchMock,
      },
    },
  });
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: LogReporterAction.PlanModeEnabled,
    entry: LogReporterEntry.PromptToolsMenu,
  })).resolves.toBe(true);

  expect(fetchMock).toHaveBeenCalledOnce();
  const request = fetchMock.mock.calls[0][0];
  const requestUrl = new URL(request.url);
  expect(request.method).toBe('GET');
  expect(requestUrl.searchParams.get('action')).toBe('lobsterai_plan_mode_enabled');
  expect(requestUrl.searchParams.get('entry')).toBe('prompt_tools_menu');
});

test('returns false when the event request is rejected', async () => {
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      },
    },
  });
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: LogReporterAction.PlanModeEnabled,
  })).resolves.toBe(false);
});

test('returns false when the Electron API bridge throws', async () => {
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: vi.fn().mockRejectedValue(new Error('network unavailable')),
      },
    },
  });
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: LogReporterAction.PlanModeEnabled,
  })).resolves.toBe(false);
});

test('rejects an event without the LobsterAI action prefix before sending', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: fetchMock,
      },
    },
  });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  await expect(reportYdAnalyzer({
    action: 'plan_mode_enabled',
  } as unknown as Parameters<typeof reportYdAnalyzer>[0])).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
