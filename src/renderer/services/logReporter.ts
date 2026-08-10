import {
  type LogEventAction,
  LogReporterAction,
  LogReporterActionPrefix,
  LogReporterCategory,
  LogReporterEndpoint,
  LogReporterEntry,
  LogReporterProduct,
} from '../../shared/analytics/constants';

export { UsageAnalyticsPolicy } from '../constants/analytics';

export {
  LogReporterAction,
  LogReporterActionPrefix,
  LogReporterCategory,
  LogReporterEndpoint,
  LogReporterEntry,
  LogReporterProduct,
};

type LogParamValue = string | number | boolean | null | undefined;

export type { LogEventAction };

export type LogEventParams = Record<string, LogParamValue> & {
  action: LogEventAction;
};

export const reportYdAnalyzer = (params: LogEventParams): Promise<boolean> => {
  void params;
  return Promise.resolve(false);
};
