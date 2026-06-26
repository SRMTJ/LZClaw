import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';

import { ShareDeploymentKind } from '../../../shared/shareDeployment/constants';
import {
  buildNodeServiceProjectPackagePlan,
  collectNodeServiceDeploymentPackageEntries,
} from './nodeServiceProjectAnalyzer';

const tempDirectories: string[] = [];

async function makeTempProject(): Promise<string> {
  const projectDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lobster-node-analyzer-test-'));
  tempDirectories.push(projectDirectory);
  await fs.promises.writeFile(
    path.join(projectDirectory, 'package.json'),
    JSON.stringify({
      name: 'test-service',
      scripts: {
        build: 'next build',
        start: 'next start',
      },
    }),
  );
  await fs.promises.writeFile(
    path.join(projectDirectory, 'package-lock.json'),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'test-service' },
      },
    }),
  );
  return projectDirectory;
}

async function makeTempNextProject(): Promise<string> {
  const projectDirectory = await makeTempProject();
  const packageJsonPath = path.join(projectDirectory, 'package.json');
  const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
  packageJson.dependencies = { next: '14.2.21', react: '18.3.1', 'react-dom': '18.3.1' };
  await fs.promises.writeFile(packageJsonPath, JSON.stringify(packageJson));
  return projectDirectory;
}

async function makeTempProjectWithDependencies(
  dependencies: Record<string, string>,
): Promise<string> {
  const projectDirectory = await makeTempProject();
  const packageJsonPath = path.join(projectDirectory, 'package.json');
  const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
  packageJson.dependencies = dependencies;
  await fs.promises.writeFile(packageJsonPath, JSON.stringify(packageJson));
  return projectDirectory;
}

async function writeFile(projectDirectory: string, relativePath: string, content = 'x'): Promise<void> {
  const filePath = path.join(projectDirectory, relativePath);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content);
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      fs.promises.rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('buildNodeServiceProjectPackagePlan', () => {
  test('uses standalone server command for Next.js projects', async () => {
    const projectDirectory = await makeTempNextProject();

    const plan = await buildNodeServiceProjectPackagePlan({
      projectDirectory,
      localServiceUrl: 'http://localhost:3000',
    });

    expect(plan.analysis.buildCommand).toBe('npm run build');
    expect(plan.analysis.deploymentKind).toBe(ShareDeploymentKind.NodeService);
    expect(plan.analysis.startCommand).toBe('node server.js');
  });

  test('uses Nitro output command for Nuxt projects', async () => {
    const projectDirectory = await makeTempProjectWithDependencies({ nuxt: '3.0.0' });

    const plan = await buildNodeServiceProjectPackagePlan({
      projectDirectory,
      localServiceUrl: 'http://localhost:3000',
    });

    expect(plan.analysis.buildCommand).toBe('npm run build');
    expect(plan.analysis.deploymentKind).toBe(ShareDeploymentKind.NodeService);
    expect(plan.analysis.startCommand).toBe('node .output/server/index.mjs');
  });

  test('uses generated static server command for static build frameworks', async () => {
    const projectDirectory = await makeTempProjectWithDependencies({ vite: '5.0.0' });

    const plan = await buildNodeServiceProjectPackagePlan({
      projectDirectory,
      localServiceUrl: 'http://localhost:3000',
    });

    expect(plan.analysis.buildCommand).toBe('npm run build');
    expect(plan.analysis.deploymentKind).toBe(ShareDeploymentKind.StaticSite);
    expect(plan.analysis.entryFile).toBe('index.html');
    expect(plan.analysis.spaFallback).toBe(true);
    expect(plan.analysis.startCommand).toBe('node server.js');
  });

  test('excludes stale build output directories from the pre-build source copy', async () => {
    const projectDirectory = await makeTempProject();
    await writeFile(projectDirectory, 'src/app.ts');
    await writeFile(projectDirectory, '.next/server/app.js');
    await writeFile(projectDirectory, 'dist/index.js');
    await writeFile(projectDirectory, 'build/index.js');
    await writeFile(projectDirectory, 'out/index.html');

    const plan = await buildNodeServiceProjectPackagePlan({
      projectDirectory,
      localServiceUrl: 'http://localhost:3000',
    });
    const archiveNames = plan.entries.map(entry => entry.archiveName);

    expect(archiveNames).toContain('src/app.ts');
    expect(archiveNames).toContain('package.json');
    expect(archiveNames).not.toContain('.next/server/app.js');
    expect(archiveNames).not.toContain('dist/index.js');
    expect(archiveNames).not.toContain('build/index.js');
    expect(archiveNames).not.toContain('out/index.html');
  });
});

describe('collectNodeServiceDeploymentPackageEntries', () => {
  test('includes built output and production dependencies in the deployment package', async () => {
    const projectDirectory = await makeTempProject();
    await writeFile(projectDirectory, '.next/server/app.js');
    await writeFile(projectDirectory, 'dist/index.js');
    await writeFile(projectDirectory, 'build/index.js');
    await writeFile(projectDirectory, 'out/index.html');
    await writeFile(projectDirectory, 'node_modules/react/index.js');
    await writeFile(projectDirectory, '.cache/ignored.js');

    const collection = await collectNodeServiceDeploymentPackageEntries(projectDirectory);
    const archiveNames = collection.entries.map(entry => entry.archiveName);

    expect(archiveNames).toContain('.next/server/app.js');
    expect(archiveNames).toContain('dist/index.js');
    expect(archiveNames).toContain('build/index.js');
    expect(archiveNames).toContain('out/index.html');
    expect(archiveNames).toContain('node_modules/react/index.js');
    expect(archiveNames).not.toContain('.cache/ignored.js');
  });
});
