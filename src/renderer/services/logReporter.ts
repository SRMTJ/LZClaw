import { store } from '../store';

export const LogReporterEndpoint = {
  YoudaoAnalyzer: 'https://rlogs.youdao.com/rlog.php',
} as const;

export const LogReporterProduct = {
  LobsterAI: 'wisdom',
} as const;

export const LogReporterCategory = {
  Event: 'event',
} as const;

export const LogReporterActionPrefix = {
  LobsterAI: 'lobsterai_',
} as const;

export const LogReporterAction = {
  PlanModeEnabled: 'lobsterai_plan_mode_enabled',
} as const;

export const LogReporterEntry = {
  PromptToolsMenu: 'prompt_tools_menu',
} as const;

type LogParamValue = string | number | boolean | null | undefined;

export type LogEventAction = `${typeof LogReporterActionPrefix.LobsterAI}${string}`;

export type LogEventParams = Record<string, LogParamValue> & {
  action: LogEventAction;
};

const logCommons = {
  _npid: LogReporterProduct.LobsterAI,
  _ncat: LogReporterCategory.Event,
} as const;

export interface BuildLogUrlOptions {
  userId?: string;
  timestamp?: number;
}

const writeReporterLog = (level: 'debug' | 'warn', message: string, error?: unknown): void => {
  if (level === 'warn') {
    if (error === undefined) {
      console.warn(`[LogReporter] ${message}`);
    } else {
      console.warn(`[LogReporter] ${message}:`, error);
    }
  } else {
    console.debug(`[LogReporter] ${message}`);
  }
  window.electron?.log?.fromRenderer?.(level, 'LogReporter', message);
};

export const buildLogUrl = (
  params: LogEventParams,
  options: BuildLogUrlOptions = {},
): string => {
  const url = new URL(LogReporterEndpoint.YoudaoAnalyzer);
  const logParams: Record<string, LogParamValue> = {
    ...params,
    ...logCommons,
    log_Usid: options.userId ?? store.getState().auth.user?.yid ?? '',
    uts: options.timestamp ?? Date.now(),
  };

  Object.entries(logParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.href;
};

export const reportYdAnalyzer = async (params: LogEventParams): Promise<boolean> => {
  if (!params.action.trim()) {
    writeReporterLog('warn', 'skipped an event without an action');
    return false;
  }

  if (!params.action.startsWith(LogReporterActionPrefix.LobsterAI)) {
    writeReporterLog('warn', 'skipped an event without the LobsterAI action prefix');
    return false;
  }

  try {
    writeReporterLog('debug', `sending event ${params.action}`);
    const response = await window.electron.api.fetch({
      url: buildLogUrl(params),
      method: 'GET',
      headers: {},
    });

    if (!response.ok) {
      writeReporterLog('warn', `event ${params.action} failed with status ${response.status}`);
      return false;
    }

    writeReporterLog('debug', `sent event ${params.action} successfully`);
    return true;
  } catch (error) {
    writeReporterLog('warn', `event ${params.action} failed`, error);
    return false;
  }
};
