import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

const requiredPatchFiles = [
  'openclaw-cron-skip-missed-jobs.patch',
  'openclaw-im-bound-agent-run-cwd.patch',
] as const;

describe('OpenClaw version patches', () => {
  test('current pinned OpenClaw version includes LobsterAI runtime patches', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const openclawVersion = packageJson.openclaw?.version;
    expect(openclawVersion).toBeTruthy();

    const patchDir = path.resolve('scripts', 'patches', openclawVersion);
    expect(fs.existsSync(patchDir)).toBe(true);

    for (const patchFile of requiredPatchFiles) {
      const patchPath = path.join(patchDir, patchFile);
      expect(fs.existsSync(patchPath)).toBe(true);
      expect(fs.readFileSync(patchPath, 'utf8').trim().length).toBeGreaterThan(0);
    }
  });
});
