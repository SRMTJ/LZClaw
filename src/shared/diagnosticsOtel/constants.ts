export interface DiagnosticsOtelCaptureContentConfig {
  enabled: boolean;
  inputMessages: boolean;
  outputMessages: boolean;
  toolInputs: boolean;
  toolOutputs: boolean;
  systemPrompt: boolean;
  toolDefinitions: boolean;
}

export interface DiagnosticsOtelSettings {
  enabled: boolean;
  serviceName: string;
  endpointBaseUrl: string;
  tracesEndpoint: string;
  metricsEndpoint: string;
  logsEndpoint: string;
  traces: boolean;
  metrics: boolean;
  logs: boolean;
  sampleRate: number;
  flushIntervalMs: number;
  captureContent: DiagnosticsOtelCaptureContentConfig;
}

export type PartialDiagnosticsOtelSettings =
  Partial<Omit<DiagnosticsOtelSettings, 'captureContent'>> & {
    captureContent?: Partial<DiagnosticsOtelCaptureContentConfig> | null;
  };

export const defaultDiagnosticsOtelCaptureContentConfig: DiagnosticsOtelCaptureContentConfig = {
  enabled: false,
  inputMessages: false,
  outputMessages: false,
  toolInputs: false,
  toolOutputs: false,
  systemPrompt: false,
  toolDefinitions: false,
};

export const defaultDiagnosticsOtelSettings: DiagnosticsOtelSettings = {
  enabled: true,
  serviceName: 'lzclaw-openclaw-gateway',
  endpointBaseUrl: '',
  tracesEndpoint: '',
  metricsEndpoint: '',
  logsEndpoint: '',
  traces: true,
  metrics: true,
  logs: true,
  sampleRate: 0.2,
  flushIntervalMs: 60000,
  captureContent: defaultDiagnosticsOtelCaptureContentConfig,
};

const isRecordObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeOptionalString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => (
  typeof value === 'boolean' ? value : fallback
);

const normalizeNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

export const normalizeDiagnosticsOtelSettings = (
  value?: PartialDiagnosticsOtelSettings | null,
): DiagnosticsOtelSettings => {
  const source = isRecordObject(value) ? value : {};
  const captureSource = isRecordObject(source.captureContent) ? source.captureContent : {};
  const captureEnabled = normalizeBoolean(
    captureSource.enabled,
    defaultDiagnosticsOtelCaptureContentConfig.enabled,
  );

  return {
    enabled: normalizeBoolean(source.enabled, defaultDiagnosticsOtelSettings.enabled),
    serviceName: normalizeString(source.serviceName, defaultDiagnosticsOtelSettings.serviceName),
    endpointBaseUrl: normalizeOptionalString(source.endpointBaseUrl),
    tracesEndpoint: normalizeOptionalString(source.tracesEndpoint),
    metricsEndpoint: normalizeOptionalString(source.metricsEndpoint),
    logsEndpoint: normalizeOptionalString(source.logsEndpoint),
    traces: normalizeBoolean(source.traces, defaultDiagnosticsOtelSettings.traces),
    metrics: normalizeBoolean(source.metrics, defaultDiagnosticsOtelSettings.metrics),
    logs: normalizeBoolean(source.logs, defaultDiagnosticsOtelSettings.logs),
    sampleRate: normalizeNumber(
      source.sampleRate,
      defaultDiagnosticsOtelSettings.sampleRate,
      0,
      1,
    ),
    flushIntervalMs: Math.round(normalizeNumber(
      source.flushIntervalMs,
      defaultDiagnosticsOtelSettings.flushIntervalMs,
      1000,
      600000,
    )),
    captureContent: {
      enabled: captureEnabled,
      inputMessages: captureEnabled && normalizeBoolean(
        captureSource.inputMessages,
        defaultDiagnosticsOtelCaptureContentConfig.inputMessages,
      ),
      outputMessages: captureEnabled && normalizeBoolean(
        captureSource.outputMessages,
        defaultDiagnosticsOtelCaptureContentConfig.outputMessages,
      ),
      toolInputs: captureEnabled && normalizeBoolean(
        captureSource.toolInputs,
        defaultDiagnosticsOtelCaptureContentConfig.toolInputs,
      ),
      toolOutputs: captureEnabled && normalizeBoolean(
        captureSource.toolOutputs,
        defaultDiagnosticsOtelCaptureContentConfig.toolOutputs,
      ),
      systemPrompt: captureEnabled && normalizeBoolean(
        captureSource.systemPrompt,
        defaultDiagnosticsOtelCaptureContentConfig.systemPrompt,
      ),
      toolDefinitions: captureEnabled && normalizeBoolean(
        captureSource.toolDefinitions,
        defaultDiagnosticsOtelCaptureContentConfig.toolDefinitions,
      ),
    },
  };
};
