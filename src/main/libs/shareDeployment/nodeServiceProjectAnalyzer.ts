import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import {
  type ShareDeploymentAnalyzeProjectInput,
  ShareDeploymentCandidateSource,
  type ShareDeploymentDetectCandidatesInput,
  ShareDeploymentKind,
  ShareDeploymentPackageManager,
  type ShareDeploymentProjectAnalysis,
  type ShareDeploymentProjectCandidate,
} from '../../../shared/shareDeployment/constants';

const execFileAsync = promisify(execFile);

export const NODE_SERVICE_DEPLOYMENT_LIMITS = {
  MaxFiles: 50000,
  MaxSourceTotalBytes: 100 * 1024 * 1024,
  MaxDeploymentTotalBytes: 500 * 1024 * 1024,
  MaxArchiveBytes: 100 * 1024 * 1024,
  CommandTimeoutMs: 10 * 60 * 1000,
} as const;

const PACKAGE_JSON_FILE_NAME = 'package.json';

const COMMON_BLOCKED_DIRECTORY_NAMES = [
  '.git',
  '.hg',
  '.svn',
  '.vite',
  '.cache',
  '.turbo',
  '.vercel',
  '.serverless',
  'coverage',
  'tmp',
  'temp',
  'logs',
] as const;

const SOURCE_BUILD_OUTPUT_DIRECTORY_NAMES = [
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.output',
  '.lobster-static-runtime',
  'dist',
  'build',
  'out',
] as const;

const SOURCE_BLOCKED_DIRECTORY_NAMES = new Set([
  ...COMMON_BLOCKED_DIRECTORY_NAMES,
  ...SOURCE_BUILD_OUTPUT_DIRECTORY_NAMES,
  'node_modules',
]);

const DEPLOYMENT_BLOCKED_DIRECTORY_NAMES = new Set(COMMON_BLOCKED_DIRECTORY_NAMES);

const BLOCKED_FILE_NAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'npm-debug.log',
  'yarn-debug.log',
  'yarn-error.log',
  'pnpm-debug.log',
]);

const PROJECT_CANDIDATE_SCAN_MAX_DEPTH = 3;
const PROJECT_CANDIDATE_SCAN_MAX_DIRECTORIES = 300;
const NEXT_STANDALONE_START_COMMAND = 'node server.js';
const NITRO_OUTPUT_START_COMMAND = 'node .output/server/index.mjs';
const STATIC_BUILD_START_COMMAND = 'node server.js';

interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: {
    node?: string;
  };
}

export interface NodeServicePackageEntry {
  absolutePath: string;
  archiveName: string;
  size: number;
}

export interface NodeServiceProjectPackagePlan {
  analysis: ShareDeploymentProjectAnalysis;
  entries: NodeServicePackageEntry[];
}

export interface NodeServicePackageCollection {
  entries: NodeServicePackageEntry[];
  totalBytes: number;
  excludedCount: number;
  warnings: string[];
  blockers: string[];
}

function normalizeArchiveName(value: string): string {
  return value.split(path.sep).join('/');
}

function parseLocalServicePort(value?: string): number | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    const port = Number(url.port);
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port;
  } catch {
    // The caller will surface a missing port as a validation issue.
  }
  return undefined;
}

function isEnvFileName(name: string): boolean {
  return /^\.env(?:\.|$)/i.test(name);
}

function isSecretLikeFileName(name: string): boolean {
  return /(?:^|[-_.])(secret|credential|credentials|token|private[-_.]?key)(?:[-_.]|$)/i.test(name);
}

function isBlockedFileName(name: string): boolean {
  return BLOCKED_FILE_NAMES.has(name) || isEnvFileName(name) || isSecretLikeFileName(name);
}

function isBlockedPathPart(part: string, blockedDirectoryNames: Set<string>): boolean {
  return blockedDirectoryNames.has(part);
}

function isBlockedRootDirectory(resolvedDirectory: string): boolean {
  const normalized = path.resolve(resolvedDirectory);
  const parsed = path.parse(normalized);
  if (normalized === parsed.root) return true;

  const homeDir = path.resolve(os.homedir());
  const blockedRoots = new Set([
    homeDir,
    path.resolve(os.tmpdir()),
    path.resolve(parsed.root, 'tmp'),
    path.resolve(parsed.root, 'var', 'tmp'),
  ]);

  if (process.platform === 'win32') {
    blockedRoots.add(path.resolve(homeDir, 'Desktop'));
    blockedRoots.add(path.resolve(homeDir, 'Documents'));
    blockedRoots.add(path.resolve(homeDir, 'Downloads'));
  } else {
    blockedRoots.add('/Users');
    blockedRoots.add('/home');
    blockedRoots.add(path.resolve(homeDir, 'Desktop'));
    blockedRoots.add(path.resolve(homeDir, 'Documents'));
    blockedRoots.add(path.resolve(homeDir, 'Downloads'));
  }

  return blockedRoots.has(normalized);
}

async function readPackageJson(projectDirectory: string): Promise<PackageJson | null> {
  try {
    const text = await fs.promises.readFile(path.join(projectDirectory, PACKAGE_JSON_FILE_NAME), 'utf8');
    return JSON.parse(text) as PackageJson;
  } catch {
    return null;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hasPackageJson(directory: string): Promise<boolean> {
  return await pathExists(path.join(directory, PACKAGE_JSON_FILE_NAME));
}

async function findNearestProjectDirectory(startDirectory: string): Promise<string | null> {
  let current = path.resolve(startDirectory);
  while (true) {
    if (await hasPackageJson(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function findProjectDirectoryCandidate(startDirectory?: string): Promise<string | null> {
  if (!startDirectory?.trim()) return null;
  const resolved = path.resolve(startDirectory.trim());
  try {
    const stat = await fs.promises.stat(resolved);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  return await findNearestProjectDirectory(resolved);
}

function resolvePackageManager(projectDirectory: string): ShareDeploymentPackageManager {
  if (fs.existsSync(path.join(projectDirectory, 'pnpm-lock.yaml'))) {
    return ShareDeploymentPackageManager.Pnpm;
  }
  if (fs.existsSync(path.join(projectDirectory, 'yarn.lock'))) {
    return ShareDeploymentPackageManager.Yarn;
  }
  if (fs.existsSync(path.join(projectDirectory, 'package-lock.json'))) {
    return ShareDeploymentPackageManager.Npm;
  }
  return ShareDeploymentPackageManager.Npm;
}

function resolveInstallCommand(packageManager: ShareDeploymentPackageManager): string {
  switch (packageManager) {
    case ShareDeploymentPackageManager.Pnpm:
      return 'pnpm install --frozen-lockfile';
    case ShareDeploymentPackageManager.Yarn:
      return 'yarn install --frozen-lockfile';
    case ShareDeploymentPackageManager.Npm:
    default:
      return 'npm ci';
  }
}

function scriptRunCommand(packageManager: ShareDeploymentPackageManager, scriptName: string): string {
  switch (packageManager) {
    case ShareDeploymentPackageManager.Pnpm:
      return `pnpm run ${scriptName}`;
    case ShareDeploymentPackageManager.Yarn:
      return `yarn run ${scriptName}`;
    case ShareDeploymentPackageManager.Npm:
    default:
      return `npm run ${scriptName}`;
  }
}

function resolveBuildCommand(
  packageJson: PackageJson | null,
  packageManager: ShareDeploymentPackageManager,
): string {
  const scripts = packageJson?.scripts ?? {};
  if (typeof scripts.build === 'string' && scripts.build.trim()) {
    return scriptRunCommand(packageManager, 'build');
  }
  return '';
}

function isNextProjectPackage(packageJson: PackageJson | null): boolean {
  return hasPackageDependency(packageJson, ['next']);
}

function hasPackageDependency(packageJson: PackageJson | null, packageNames: string[]): boolean {
  const dependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };
  return packageNames.some(packageName => Boolean(dependencies[packageName]));
}

function isNuxtProjectPackage(packageJson: PackageJson | null): boolean {
  return hasPackageDependency(packageJson, ['nuxt', 'nuxt3']);
}

function isStaticBuildProjectPackage(packageJson: PackageJson | null): boolean {
  return hasPackageDependency(packageJson, [
    'vite',
    'react-scripts',
    '@vue/cli-service',
    '@angular/cli',
    'astro',
    'parcel',
    '@sveltejs/vite-plugin-svelte',
  ]);
}

function resolveStartCommand(
  packageJson: PackageJson | null,
  packageManager: ShareDeploymentPackageManager,
): string {
  const scripts = packageJson?.scripts ?? {};
  if (
    isNextProjectPackage(packageJson) &&
    typeof scripts.build === 'string' &&
    scripts.build.trim()
  ) {
    return NEXT_STANDALONE_START_COMMAND;
  }
  if (
    isNuxtProjectPackage(packageJson) &&
    typeof scripts.build === 'string' &&
    scripts.build.trim()
  ) {
    return NITRO_OUTPUT_START_COMMAND;
  }
  if (
    isStaticBuildProjectPackage(packageJson) &&
    typeof scripts.build === 'string' &&
    scripts.build.trim()
  ) {
    return STATIC_BUILD_START_COMMAND;
  }
  if (typeof scripts.start === 'string' && scripts.start.trim()) return scriptRunCommand(packageManager, 'start');
  if (typeof scripts.serve === 'string' && scripts.serve.trim()) return scriptRunCommand(packageManager, 'serve');
  if (typeof scripts.dev === 'string' && scripts.dev.trim()) return scriptRunCommand(packageManager, 'dev');
  return '';
}

function resolveDeploymentKind(packageJson: PackageJson | null): ShareDeploymentKind {
  if (isStaticBuildProjectPackage(packageJson) && !isNextProjectPackage(packageJson) && !isNuxtProjectPackage(packageJson)) {
    return ShareDeploymentKind.StaticSite;
  }
  return ShareDeploymentKind.NodeService;
}

function hasRunnableScript(packageJson: PackageJson | null): boolean {
  const scripts = packageJson?.scripts ?? {};
  if (
    isNextProjectPackage(packageJson) &&
    typeof scripts.build === 'string' &&
    scripts.build.trim().length > 0
  ) {
    return true;
  }
  if (
    (isNuxtProjectPackage(packageJson) || isStaticBuildProjectPackage(packageJson)) &&
    typeof scripts.build === 'string' &&
    scripts.build.trim().length > 0
  ) {
    return true;
  }
  return ['start', 'serve', 'dev'].some(scriptName => {
    const script = scripts[scriptName];
    return typeof script === 'string' && script.trim().length > 0;
  });
}

async function isUsableNodeProjectDirectory(projectDirectory: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(projectDirectory);
    if (!stat.isDirectory() || isBlockedRootDirectory(projectDirectory)) return false;
    const packageJson = await readPackageJson(projectDirectory);
    return hasRunnableScript(packageJson);
  } catch {
    return false;
  }
}

function resolveNodeVersion(packageJson: PackageJson | null): string {
  const engine = packageJson?.engines?.node;
  if (typeof engine !== 'string') return '20';
  const majorMatch = engine.match(/(?:^|[^\d])(\d{2})(?:[^\d]|$)/);
  const major = majorMatch?.[1];
  if (major === '18' || major === '20' || major === '22') return major;
  return '20';
}

async function collectPackageEntries(
  projectDirectory: string,
  blockedDirectoryNames: Set<string>,
  maxTotalBytes: number,
): Promise<NodeServicePackageCollection> {
  const entries: NodeServicePackageEntry[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  let totalBytes = 0;
  let excludedCount = 0;

  async function walk(directory: string): Promise<void> {
    if (blockers.length > 0) return;

    const children = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const child of children) {
      if (blockers.length > 0) return;
      const absolutePath = path.join(directory, child.name);
      const relativePath = path.relative(projectDirectory, absolutePath);
      const relativeParts = relativePath.split(path.sep).filter(Boolean);
      if (
        relativeParts.some(part => isBlockedPathPart(part, blockedDirectoryNames)) ||
        isBlockedFileName(child.name)
      ) {
        excludedCount += 1;
        continue;
      }
      if (child.isSymbolicLink()) {
        excludedCount += 1;
        continue;
      }
      if (child.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!child.isFile()) {
        excludedCount += 1;
        continue;
      }

      const stat = await fs.promises.stat(absolutePath);
      totalBytes += stat.size;
      entries.push({
        absolutePath,
        archiveName: normalizeArchiveName(relativePath),
        size: stat.size,
      });
      if (entries.length > NODE_SERVICE_DEPLOYMENT_LIMITS.MaxFiles) {
        blockers.push(`Project has more than ${NODE_SERVICE_DEPLOYMENT_LIMITS.MaxFiles} files after exclusions.`);
        return;
      }
      if (totalBytes > maxTotalBytes) {
        blockers.push(
          `Project files exceed ${Math.floor(maxTotalBytes / 1024 / 1024)}MB after exclusions.`,
        );
        return;
      }
    }
  }

  await walk(projectDirectory);

  if (excludedCount > 0) {
    warnings.push(`${excludedCount} files or directories will be excluded from the deployment package.`);
  }

  return {
    entries: entries.sort((a, b) => a.archiveName.localeCompare(b.archiveName)),
    totalBytes,
    excludedCount,
    warnings,
    blockers,
  };
}

export async function collectNodeServiceDeploymentPackageEntries(
  projectDirectory: string,
): Promise<NodeServicePackageCollection> {
  return await collectPackageEntries(
    projectDirectory,
    DEPLOYMENT_BLOCKED_DIRECTORY_NAMES,
    NODE_SERVICE_DEPLOYMENT_LIMITS.MaxDeploymentTotalBytes,
  );
}

export async function buildNodeServiceProjectPackagePlan(
  input: ShareDeploymentAnalyzeProjectInput,
): Promise<NodeServiceProjectPackagePlan> {
  const projectDirectory = path.resolve(input.projectDirectory.trim());
  const warnings: string[] = [];
  const blockers: string[] = [];

  let stat: fs.Stats | null = null;
  try {
    stat = await fs.promises.stat(projectDirectory);
  } catch {
    blockers.push('Project directory does not exist.');
  }

  if (stat && !stat.isDirectory()) {
    blockers.push('Project path must be a directory.');
  }

  if (isBlockedRootDirectory(projectDirectory)) {
    blockers.push('Choose a project subdirectory instead of a system, home, or shared root directory.');
  }

  const packageJson = await readPackageJson(projectDirectory);
  if (!packageJson) {
    blockers.push('Project directory must contain package.json.');
  }

  const packageManager = resolvePackageManager(projectDirectory);
  const installCommand = resolveInstallCommand(packageManager);
  const buildCommand = resolveBuildCommand(packageJson, packageManager);
  const startCommand = resolveStartCommand(packageJson, packageManager);
  const deploymentKind = resolveDeploymentKind(packageJson);
  const nodeVersion = resolveNodeVersion(packageJson);
  const port = parseLocalServicePort(input.localServiceUrl);

  if (!startCommand) {
    blockers.push('package.json must define a start, serve, or dev script.');
  }
  if (!port) {
    blockers.push('Local service URL must include a valid port.');
  }
  if (startCommand.endsWith(' run dev')) {
    warnings.push('Only a dev script was found. Confirm the service can run in a cloud deployment.');
  }
  if (packageManager === ShareDeploymentPackageManager.Npm && !fs.existsSync(path.join(projectDirectory, 'package-lock.json'))) {
    warnings.push('No package-lock.json was found. npm install behavior may be less reproducible.');
  }

  const shouldCollectPackageEntries = Boolean(stat?.isDirectory() && blockers.length === 0);
  const collected = shouldCollectPackageEntries
    ? await collectPackageEntries(
        projectDirectory,
        SOURCE_BLOCKED_DIRECTORY_NAMES,
        NODE_SERVICE_DEPLOYMENT_LIMITS.MaxSourceTotalBytes,
      )
    : {
        entries: [],
        totalBytes: 0,
        excludedCount: 0,
        warnings: [],
        blockers: [],
      };

  const analysis: ShareDeploymentProjectAnalysis = {
    success: blockers.length === 0 && collected.blockers.length === 0,
    projectDirectory,
    packageName: typeof packageJson?.name === 'string' ? packageJson.name : undefined,
    packageVersion: typeof packageJson?.version === 'string' ? packageJson.version : undefined,
    deploymentKind,
    entryFile: deploymentKind === ShareDeploymentKind.StaticSite ? 'index.html' : undefined,
    spaFallback: deploymentKind === ShareDeploymentKind.StaticSite ? true : undefined,
    packageManager,
    nodeVersion,
    installCommand,
    buildCommand,
    startCommand,
    port,
    totalFiles: collected.entries.length,
    totalBytes: collected.totalBytes,
    excludedCount: collected.excludedCount,
    warnings: [...warnings, ...collected.warnings],
    blockers: [...blockers, ...collected.blockers],
  };

  return {
    analysis,
    entries: collected.entries,
  };
}

export async function analyzeNodeServiceProjectDirectory(
  input: ShareDeploymentAnalyzeProjectInput,
): Promise<ShareDeploymentProjectAnalysis> {
  try {
    return (await buildNodeServiceProjectPackagePlan(input)).analysis;
  } catch (error) {
    return {
      success: false,
      projectDirectory: input.projectDirectory,
      packageManager: ShareDeploymentPackageManager.Unknown,
      nodeVersion: '20',
      installCommand: 'npm ci',
      buildCommand: '',
      startCommand: '',
      totalFiles: 0,
      totalBytes: 0,
      excludedCount: 0,
      warnings: [],
      blockers: [error instanceof Error ? error.message : 'Failed to analyze project directory.'],
    };
  }
}

async function getPidListeningOnPort(port: number): Promise<string | null> {
  if (process.platform === 'win32') return null;
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], {
      timeout: 1500,
    });
    const pidLine = stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => /^p\d+$/.test(line));
    return pidLine ? pidLine.slice(1) : null;
  } catch {
    return null;
  }
}

async function getProcessCwd(pid: string): Promise<string | null> {
  if (process.platform === 'win32') return null;
  if (process.platform === 'darwin') {
    const procCwd = `/proc/${pid}/cwd`;
    try {
      return await fs.promises.realpath(procCwd);
    } catch {
      // macOS does not expose /proc by default; fall through to lsof.
    }
  }
  try {
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], {
      timeout: 1500,
    });
    const cwdLine = stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line.startsWith('n'));
    return cwdLine ? cwdLine.slice(1) : null;
  } catch {
    return null;
  }
}

function pushUniqueCandidate(
  candidates: ShareDeploymentProjectCandidate[],
  candidate: ShareDeploymentProjectCandidate | null,
): void {
  if (!candidate?.directory) return;
  const normalized = path.resolve(candidate.directory);
  if (candidates.some(item => path.resolve(item.directory) === normalized)) return;
  candidates.push({
    ...candidate,
    directory: normalized,
  });
}

async function findWorkspaceChildProjectCandidates(
  workingDirectory?: string,
): Promise<ShareDeploymentProjectCandidate[]> {
  if (!workingDirectory?.trim()) return [];

  const root = path.resolve(workingDirectory.trim());
  try {
    const stat = await fs.promises.stat(root);
    if (!stat.isDirectory() || isBlockedRootDirectory(root)) return [];
  } catch {
    return [];
  }

  const candidates: ShareDeploymentProjectCandidate[] = [];
  let visitedDirectories = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > PROJECT_CANDIDATE_SCAN_MAX_DEPTH) return;
    if (visitedDirectories >= PROJECT_CANDIDATE_SCAN_MAX_DIRECTORIES) return;

    let children: fs.Dirent[];
    try {
      children = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const child of children) {
      if (visitedDirectories >= PROJECT_CANDIDATE_SCAN_MAX_DIRECTORIES) return;
      if (!child.isDirectory() || child.isSymbolicLink()) continue;
      if (isBlockedPathPart(child.name, SOURCE_BLOCKED_DIRECTORY_NAMES)) continue;

      const childDirectory = path.join(directory, child.name);
      visitedDirectories += 1;
      if (await isUsableNodeProjectDirectory(childDirectory)) {
        pushUniqueCandidate(candidates, {
          directory: childDirectory,
          source: ShareDeploymentCandidateSource.WorkspaceChild,
          confidence: Math.max(50, 76 - depth * 6),
          reason: 'Found a runnable Node project under the current workspace directory.',
        });
      }

      await walk(childDirectory, depth + 1);
    }
  }

  await walk(root, 1);
  return candidates;
}

export async function detectNodeServiceProjectCandidates(
  input: ShareDeploymentDetectCandidatesInput,
): Promise<ShareDeploymentProjectCandidate[]> {
  const candidates: ShareDeploymentProjectCandidate[] = [];
  const port = parseLocalServicePort(input.localServiceUrl);

  if (port) {
    const pid = await getPidListeningOnPort(port);
    const cwd = pid ? await getProcessCwd(pid) : null;
    const projectDirectory = cwd ? await findProjectDirectoryCandidate(cwd) : null;
    const usableProjectDirectory =
      projectDirectory && await isUsableNodeProjectDirectory(projectDirectory)
        ? projectDirectory
        : null;
    pushUniqueCandidate(
      candidates,
      usableProjectDirectory
        ? {
            directory: usableProjectDirectory,
            source: ShareDeploymentCandidateSource.Process,
            confidence: 95,
            reason: `Matched the process listening on port ${port}.`,
          }
        : null,
    );
  }

  const workspaceProjectDirectory = await findProjectDirectoryCandidate(input.workingDirectory);
  const usableWorkspaceProjectDirectory =
    workspaceProjectDirectory && await isUsableNodeProjectDirectory(workspaceProjectDirectory)
      ? workspaceProjectDirectory
      : null;
  pushUniqueCandidate(
    candidates,
    usableWorkspaceProjectDirectory
      ? {
          directory: usableWorkspaceProjectDirectory,
          source: ShareDeploymentCandidateSource.Workspace,
          confidence: 80,
          reason: 'Matched the current workspace directory.',
        }
      : null,
  );

  for (const childProjectCandidate of await findWorkspaceChildProjectCandidates(input.workingDirectory)) {
    pushUniqueCandidate(candidates, childProjectCandidate);
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
