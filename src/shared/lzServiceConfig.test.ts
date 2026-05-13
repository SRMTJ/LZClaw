import { expect, test } from 'vitest';

import {
  buildLzServiceEndpoints,
  LZ_SERVICE_DEFAULT_BASE_URL,
  LZ_SERVICE_ENVIRONMENTS,
  normalizeLzServiceBaseUrl,
} from './lzServiceConfig';

test('normalizeLzServiceBaseUrl trims trailing slashes', () => {
  expect(normalizeLzServiceBaseUrl('http://127.0.0.1:5000///')).toBe('http://127.0.0.1:5000');
});

test('normalizeLzServiceBaseUrl falls back to the default local LZService URL', () => {
  expect(normalizeLzServiceBaseUrl('')).toBe(LZ_SERVICE_DEFAULT_BASE_URL);
});

test('buildLzServiceEndpoints builds test login and update routes', () => {
  const endpoints = buildLzServiceEndpoints(
    'http://127.0.0.1:5000/',
    LZ_SERVICE_ENVIRONMENTS.Test,
  );

  expect(endpoints.serverApiBaseUrl).toBe('http://127.0.0.1:5000');
  expect(endpoints.loginUrl).toBe(
    'http://127.0.0.1:5000/openapi/get/luna/hardware/lobsterai/test/login-url',
  );
  expect(endpoints.updateUrl).toBe(
    'http://127.0.0.1:5000/openapi/get/luna/hardware/lobsterai/test/update',
  );
  expect(endpoints.manualUpdateUrl).toBe(
    'http://127.0.0.1:5000/openapi/get/luna/hardware/lobsterai/test/update-manual',
  );
  expect(endpoints.skillStoreUrl).toBe(
    'http://127.0.0.1:5000/openapi/get/luna/hardware/lobsterai/test/skill-store',
  );
  expect(endpoints.agentTemplateUrl).toBe(
    'http://127.0.0.1:5000/openapi/get/luna/hardware/lobsterai/test/agent-template',
  );
});

test('buildLzServiceEndpoints builds prod login and update routes', () => {
  const endpoints = buildLzServiceEndpoints(
    'http://service.local',
    LZ_SERVICE_ENVIRONMENTS.Prod,
  );

  expect(endpoints.loginUrl).toBe(
    'http://service.local/openapi/get/luna/hardware/lobsterai/prod/login-url',
  );
  expect(endpoints.updateUrl).toBe(
    'http://service.local/openapi/get/luna/hardware/lobsterai/prod/update',
  );
  expect(endpoints.manualUpdateUrl).toBe(
    'http://service.local/openapi/get/luna/hardware/lobsterai/prod/update-manual',
  );
  expect(endpoints.skillStoreUrl).toBe(
    'http://service.local/openapi/get/luna/hardware/lobsterai/prod/skill-store',
  );
  expect(endpoints.agentTemplateUrl).toBe(
    'http://service.local/openapi/get/luna/hardware/lobsterai/prod/agent-template',
  );
});
