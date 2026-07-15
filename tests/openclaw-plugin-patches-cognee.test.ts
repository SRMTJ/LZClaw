import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const {
  extractLatestCogneeConversationTurn,
  patchCognee,
} = require('../scripts/openclaw-plugin-patches/cognee.cjs');

describe('openclaw Cognee plugin patch', () => {
  test('extracts the latest visible turn and removes LobsterAI managed prompt context', () => {
    const turn = extractLatestCogneeConversationTurn([
      {
        role: 'user',
        content: 'old question',
        idempotencyKey: 'old-user',
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'old answer' }],
        responseId: 'old-assistant',
      },
      {
        role: 'user',
        content: '## Local Time Context\nignored\n\n[Current user request]\n五岳是哪五座山',
        idempotencyKey: 'current-user',
      },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'private reasoning' },
          { type: 'tool_use', name: 'search', input: { query: 'secret tool input' } },
          { type: 'text', text: '东岳泰山、西岳华山、南岳衡山、北岳恒山、中岳嵩山' },
        ],
        responseId: 'current-assistant',
      },
    ]);

    expect(turn).toEqual({
      question: '五岳是哪五座山',
      answer: '东岳泰山、西岳华山、南岳衡山、北岳恒山、中岳嵩山',
      userIdentity: 'current-user',
      assistantIdentity: 'current-assistant',
    });
    expect(JSON.stringify(turn)).not.toContain('private reasoning');
    expect(JSON.stringify(turn)).not.toContain('secret tool input');
  });

  test('supports JSONL message envelopes and skips turns without a final answer', () => {
    expect(extractLatestCogneeConversationTurn([
      {
        type: 'message',
        message: {
          role: 'user',
          content: '[Current user request]\n只有问题',
          idempotencyKey: 'user-1',
        },
      },
    ])).toBeNull();
  });

  test('patches the pinned plugin idempotently', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cognee-plugin-patch-'));
    const distDir = path.join(tempDir, 'cognee-openclaw', 'dist', 'src');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'client.js'),
      [
        'export class CogneeHttpClient {',
        '    // POST /api/v1/improve — Cognee 1.0.3\'s memory-oriented alias for /memify.',
        '    async improve(params) {}',
        '}',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(distDir, 'client.d.ts'),
      ['export declare class CogneeHttpClient {', '    improve(params: {}): Promise<{}>;', '}'].join('\n'),
    );
    fs.writeFileSync(
      path.join(distDir, 'plugin.js'),
      [
        'const autoSyncedWorkspaces = new Set();',
        'function register(api) {',
        '    const cfg = {};',
        '    const client = {};',
        '    const multiScope = false;',
        '    let sessionId;',
        '        // ------------------------------------------------------------------',
        '        // Post-agent sync + session persistence',
        '        // ------------------------------------------------------------------',
        '}',
      ].join('\n'),
    );

    patchCognee({ runtimeExtensionsDir: tempDir, log: () => {} });
    patchCognee({ runtimeExtensionsDir: tempDir, log: () => {} });

    const client = fs.readFileSync(path.join(distDir, 'client.js'), 'utf-8');
    const declarations = fs.readFileSync(path.join(distDir, 'client.d.ts'), 'utf-8');
    const plugin = fs.readFileSync(path.join(distDir, 'plugin.js'), 'utf-8');
    expect(client.match(/lzclaw_cognee_remember_entry_patch/g)).toHaveLength(1);
    expect(client).toContain('"/api/v1/remember/entry"');
    expect(declarations.match(/rememberEntry\(params:/g)).toHaveLength(1);
    expect(plugin.match(/lzclaw_cognee_agent_end_capture_patch/g)).toHaveLength(1);
    expect(plugin).toContain('api.on("agent_end"');
    expect(plugin).toContain('client.rememberEntry({');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
