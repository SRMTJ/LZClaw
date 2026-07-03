import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  DIAGNOSTICS_OTEL_PACKAGE_NAME,
  DIAGNOSTICS_OTEL_PACKAGE_VERSION,
  DIAGNOSTICS_OTEL_PLUGIN_ID,
  resolveDiagnosticsOtelStateProjectPaths,
  syncDiagnosticsOtelStateNpmProject,
} from './openclawDiagnosticsOtelState';

const makeRuntimeWithDiagnosticsSource = (): { root: string; sourceDir: string } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lzclaw-runtime-'));
  const sourceDir = path.join(root, 'preinstalled-extensions', DIAGNOSTICS_OTEL_PLUGIN_ID);
  fs.mkdirSync(path.join(sourceDir, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, 'openclaw.plugin.json'),
    JSON.stringify({ id: DIAGNOSTICS_OTEL_PLUGIN_ID }),
  );
  fs.writeFileSync(
    path.join(sourceDir, 'package.json'),
    JSON.stringify({
      name: DIAGNOSTICS_OTEL_PACKAGE_NAME,
      version: DIAGNOSTICS_OTEL_PACKAGE_VERSION,
      openclaw: { extensions: ['openclaw.plugin.json'] },
    }),
  );
  fs.writeFileSync(path.join(sourceDir, 'dist', 'index.js'), 'export {};\n');
  return { root, sourceDir };
};

describe('openclaw diagnostics otel state npm project', () => {
  test('syncs the preinstalled diagnostics package into a recoverable npm project', () => {
    const runtime = makeRuntimeWithDiagnosticsSource();
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lzclaw-state-'));

    try {
      const result = syncDiagnosticsOtelStateNpmProject(runtime.root, stateDir);
      const paths = resolveDiagnosticsOtelStateProjectPaths(stateDir);
      const projectPackageJson = JSON.parse(
        fs.readFileSync(paths.projectPackageJsonPath, 'utf8'),
      );

      expect(result.synced).toBe(true);
      expect(fs.existsSync(path.join(paths.packageDir, 'openclaw.plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(paths.packageDir, 'dist', 'index.js'))).toBe(true);
      expect(projectPackageJson.dependencies).toEqual({
        [DIAGNOSTICS_OTEL_PACKAGE_NAME]: DIAGNOSTICS_OTEL_PACKAGE_VERSION,
      });
    } finally {
      fs.rmSync(runtime.root, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  test('skips when the state npm project is already up to date', () => {
    const runtime = makeRuntimeWithDiagnosticsSource();
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lzclaw-state-'));

    try {
      expect(syncDiagnosticsOtelStateNpmProject(runtime.root, stateDir).synced).toBe(true);
      const second = syncDiagnosticsOtelStateNpmProject(runtime.root, stateDir);
      expect(second.synced).toBe(false);
      expect(second.skippedReason).toBe('up-to-date');
    } finally {
      fs.rmSync(runtime.root, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  test('skips cleanly when the preinstalled source is absent', () => {
    const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lzclaw-runtime-'));
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lzclaw-state-'));

    try {
      const result = syncDiagnosticsOtelStateNpmProject(runtimeRoot, stateDir);
      expect(result.synced).toBe(false);
      expect(result.skippedReason).toBe('missing-source');
    } finally {
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
