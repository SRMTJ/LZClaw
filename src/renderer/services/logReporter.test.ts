import { expect, test, vi } from 'vitest';

import {
  LogReporterAction,
  LogReporterEntry,
  reportYdAnalyzer,
  UsageAnalyticsPolicy,
} from './logReporter';

test('does not send product analytics events', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('window', {
    electron: {
      api: {
        fetch: fetchMock,
      },
    },
  });

  await expect(reportYdAnalyzer({
    action: LogReporterAction.PlanModeEnabled,
    entry: LogReporterEntry.PromptToolsMenu,
  })).resolves.toBe(false);

  expect(UsageAnalyticsPolicy.Enabled).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
