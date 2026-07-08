import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  type MemoryIndexMigrationRunner,
  migrateMainFtsOnlyMemoryIndex,
  resolveMainMemoryIndexMigrationNeed,
} from './openclawMemoryIndexMigration';

let tmpDir = '';
let stateDir = '';
let runtimeRoot = '';
let configPath = '';
let dbPath = '';
let electronNodeRuntimePath = '';

function mkdirp(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string): void {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeConfig(memorySearch: Record<string, unknown>, agentMemorySearch?: Record<string, unknown>): void {
  const mainAgent: Record<string, unknown> = { id: 'main', default: true };
  if (agentMemorySearch) {
    mainAgent.memorySearch = agentMemorySearch;
  }
  writeFile(
    configPath,
    `${JSON.stringify({
      gateway: { mode: 'local' },
      agents: {
        defaults: {
          workspace: path.join(stateDir, 'workspace-main'),
          memorySearch,
        },
        list: [mainAgent],
      },
    }, null, 2)}\n`,
  );
}

function writeIndexMeta(meta: Record<string, unknown> | null): void {
  mkdirp(path.dirname(dbPath));
  const db = new Database(dbPath);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    if (meta) {
      db
        .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
        .run('memory_index_meta_v1', JSON.stringify(meta));
    }
  } finally {
    db.close();
  }
}

function writeEmptySqlite(): void {
  mkdirp(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.close();
}

function ftsOnlyMemorySearch(): Record<string, unknown> {
  return {
    enabled: true,
    provider: 'none',
    fallback: 'none',
    store: {
      fts: { tokenizer: 'trigram' },
      vector: { enabled: false },
    },
  };
}

describe('openclawMemoryIndexMigration', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobsterai-openclaw-memory-migration-'));
    stateDir = path.join(tmpDir, 'openclaw', 'state');
    runtimeRoot = path.join(tmpDir, 'runtime');
    configPath = path.join(stateDir, 'openclaw.json');
    dbPath = path.join(stateDir, 'memory', 'main.sqlite');
    electronNodeRuntimePath = process.execPath;
    mkdirp(runtimeRoot);
    writeFile(path.join(runtimeRoot, 'openclaw.mjs'), 'console.log("openclaw");\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('skips when config still uses an embedding provider', async () => {
    writeConfig({
      enabled: true,
      provider: 'gemini',
      model: 'gemini-embedding-001',
      store: { fts: { tokenizer: 'trigram' } },
    });
    writeIndexMeta({
      model: 'gemini-embedding-001',
      provider: 'gemini',
      ftsTokenizer: 'trigram',
    });
    const runner = vi.fn<MemoryIndexMigrationRunner>();

    const result = await migrateMainFtsOnlyMemoryIndex({
      stateDir,
      configPath,
      runtimeRoot,
      electronNodeRuntimePath,
      env: {},
      runner,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'not-fts-only-config' });
    expect(runner).not.toHaveBeenCalled();
  });

  test('skips when main agent overrides defaults with an embedding provider', async () => {
    writeConfig(ftsOnlyMemorySearch(), {
      enabled: true,
      provider: 'gemini',
      model: 'gemini-embedding-001',
      store: { fts: { tokenizer: 'trigram' } },
    });
    writeIndexMeta({
      model: 'gemini-embedding-001',
      provider: 'gemini',
      ftsTokenizer: 'trigram',
    });

    expect(resolveMainMemoryIndexMigrationNeed({ configPath, stateDir })).toEqual({
      shouldMigrate: false,
      reason: 'not-fts-only-config',
    });
  });

  test('skips when FTS-only index metadata is current', async () => {
    writeConfig(ftsOnlyMemorySearch());
    writeIndexMeta({
      model: 'fts-only',
      provider: 'none',
      ftsTokenizer: 'trigram',
    });
    const runner = vi.fn<MemoryIndexMigrationRunner>();

    const result = await migrateMainFtsOnlyMemoryIndex({
      stateDir,
      configPath,
      runtimeRoot,
      electronNodeRuntimePath,
      env: {},
      runner,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'index-meta-current' });
    expect(runner).not.toHaveBeenCalled();
  });

  test('runs official forced reindex when old embedding metadata exists under FTS-only config', async () => {
    writeConfig(ftsOnlyMemorySearch());
    writeIndexMeta({
      model: 'gemini-embedding-001',
      provider: 'gemini',
      ftsTokenizer: 'unicode61',
    });
    const runner = vi.fn<MemoryIndexMigrationRunner>().mockResolvedValue({
      code: 0,
      stdout: 'updated',
      stderr: '',
    });

    const result = await migrateMainFtsOnlyMemoryIndex({
      stateDir,
      configPath,
      runtimeRoot,
      electronNodeRuntimePath,
      env: { EXISTING: '1' },
      runner,
    });

    expect(result.status).toBe('migrated');
    expect(runner).toHaveBeenCalledTimes(1);
    const [command, args, options] = runner.mock.calls[0];
    expect(command).toBe(electronNodeRuntimePath);
    expect(args).toEqual([
      path.join(runtimeRoot, 'openclaw.mjs'),
      'memory',
      'index',
      '--force',
      '--agent',
      'main',
    ]);
    expect(options.cwd).toBe(runtimeRoot);
    expect(options.timeoutMs).toBeGreaterThan(0);
    expect(options.env.EXISTING).toBe('1');
    expect(options.env.OPENCLAW_HOME).toBe(path.dirname(stateDir));
    expect(options.env.OPENCLAW_STATE_DIR).toBe(stateDir);
    expect(options.env.OPENCLAW_CONFIG_PATH).toBe(configPath);
    expect(options.env.ELECTRON_RUN_AS_NODE).toBe('1');
  });

  test('runs forced reindex when metadata is missing', async () => {
    writeConfig(ftsOnlyMemorySearch());
    writeIndexMeta(null);

    expect(resolveMainMemoryIndexMigrationNeed({ configPath, stateDir })).toMatchObject({
      shouldMigrate: true,
      dbPath,
      reason: 'index metadata is missing',
    });
  });

  test('runs forced reindex when sqlite meta table is missing', async () => {
    writeConfig(ftsOnlyMemorySearch());
    writeEmptySqlite();

    expect(resolveMainMemoryIndexMigrationNeed({ configPath, stateDir })).toMatchObject({
      shouldMigrate: true,
      dbPath,
      reason: 'index metadata is missing',
    });
  });

  test('skips when bundled OpenClaw CLI is missing', async () => {
    fs.rmSync(path.join(runtimeRoot, 'openclaw.mjs'), { force: true });
    writeConfig(ftsOnlyMemorySearch());
    writeIndexMeta({
      model: 'gemini-embedding-001',
      provider: 'gemini',
      ftsTokenizer: 'unicode61',
    });
    const runner = vi.fn<MemoryIndexMigrationRunner>();

    const result = await migrateMainFtsOnlyMemoryIndex({
      stateDir,
      configPath,
      runtimeRoot,
      electronNodeRuntimePath,
      env: {},
      runner,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'missing-openclaw-cli' });
    expect(runner).not.toHaveBeenCalled();
  });

  test('returns failed when forced reindex exits non-zero', async () => {
    writeConfig(ftsOnlyMemorySearch());
    writeIndexMeta({
      model: 'gemini-embedding-001',
      provider: 'gemini',
      ftsTokenizer: 'unicode61',
    });
    const runner = vi.fn<MemoryIndexMigrationRunner>().mockResolvedValue({
      code: 2,
      stdout: '',
      stderr: 'failed',
    });

    const result = await migrateMainFtsOnlyMemoryIndex({
      stateDir,
      configPath,
      runtimeRoot,
      electronNodeRuntimePath,
      env: {},
      runner,
    });

    expect(result).toEqual({ status: 'failed', code: 2 });
  });
});
