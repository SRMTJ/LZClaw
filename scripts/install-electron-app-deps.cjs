#!/usr/bin/env node

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === 'npm_config_allow_scripts') {
    delete env[key];
  }
}

const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
const result = spawnSync(process.execPath, [electronBuilderCli, 'install-app-deps'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
