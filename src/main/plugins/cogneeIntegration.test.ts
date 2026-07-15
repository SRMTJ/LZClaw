import { describe, expect, test, vi } from 'vitest';

import {
  buildCogneeOpenClawConfig,
  testCogneeConnection,
} from './cogneeIntegration';

describe('Cognee integration', () => {
  test('writes environment placeholders instead of plaintext credentials', () => {
    const config = buildCogneeOpenClawConfig({
      baseUrl: 'http://127.0.0.1:8000',
      username: 'admin@example.com',
      password: 'must-not-survive',
    });

    expect(config.password).toBe('${COGNEE_PASSWORD}');
    expect(JSON.stringify(config)).not.toContain('must-not-survive');
  });

  test('uses only the selected API key credential mode in OpenClaw config', () => {
    const config = buildCogneeOpenClawConfig({
      credentialMode: 'apiKey',
      username: 'unused@example.com',
      password: 'must-not-survive',
      apiKey: 'must-not-survive-either',
    });

    expect(config.apiKey).toBe('${COGNEE_API_KEY}');
    expect(config).not.toHaveProperty('password');
    expect(config).not.toHaveProperty('credentialMode');
    expect(JSON.stringify(config)).not.toContain('must-not-survive');
  });

  test('validates health, login, and authenticated identity', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ready', version: '1.3.0-local' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token-123' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'admin@example.com' }), { status: 200 }));

    const result = await testCogneeConnection({
      baseUrl: 'http://127.0.0.1:8000',
      username: 'admin@example.com',
      password: 'draft-secret',
    }, {}, fetchImpl);

    expect(result).toEqual({
      ok: true,
      reachable: true,
      authenticated: true,
      message: 'Cognee 连接和凭据验证成功',
      version: '1.3.0-local',
      user: 'admin@example.com',
    });
    expect(fetchImpl.mock.calls[1][1].body).toContain('password=draft-secret');
    expect(fetchImpl.mock.calls[2][1].headers.Authorization).toBe('Bearer token-123');
  });
});
