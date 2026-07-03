import fs from 'fs';
import path from 'path';

export const DIAGNOSTICS_OTEL_PLUGIN_ID = 'diagnostics-otel';
export const DIAGNOSTICS_OTEL_PACKAGE_NAME = '@openclaw/diagnostics-otel';
export const DIAGNOSTICS_OTEL_PACKAGE_VERSION = '2026.6.1';

const PREINSTALLED_EXTENSIONS_DIR = 'preinstalled-extensions';
const STATE_NPM_PROJECT_NAME = 'zz-lzclaw-diagnostics-otel-2026-6-1';
const STATE_PROJECT_PACKAGE_NAME = 'lzclaw-openclaw-diagnostics-otel';
const SYNC_MARKER_FILE = '.lzclaw-diagnostics-otel-sync.json';

type PackageJson = {
  name?: unknown;
  version?: unknown;
};

export interface DiagnosticsOtelStateProjectPaths {
  projectDir: string;
  packageDir: string;
  projectPackageJsonPath: string;
  syncMarkerPath: string;
}

export interface DiagnosticsOtelStateSyncResult {
  synced: boolean;
  skippedReason?: 'missing-source' | 'up-to-date' | 'invalid-source';
  sourceDir?: string;
  projectDir: string;
  packageDir: string;
}

type SourceSignature = {
  packageName: string;
  packageVersion: string;
  packageJsonSize: number;
  packageJsonMtimeMs: number;
  manifestSize: number;
  manifestMtimeMs: number;
};

const readJsonFile = <T>(filePath: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
};

const isDirectory = (dir: string): boolean => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

const buildSourceSignature = (sourceDir: string): SourceSignature | null => {
  const manifestPath = path.join(sourceDir, 'openclaw.plugin.json');
  const packageJsonPath = path.join(sourceDir, 'package.json');
  const manifest = readJsonFile<{ id?: unknown }>(manifestPath);
  const packageJson = readJsonFile<PackageJson>(packageJsonPath);

  if (manifest?.id !== DIAGNOSTICS_OTEL_PLUGIN_ID) {
    return null;
  }
  if (packageJson?.name !== DIAGNOSTICS_OTEL_PACKAGE_NAME) {
    return null;
  }
  if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
    return null;
  }

  const manifestStat = fs.statSync(manifestPath);
  const packageJsonStat = fs.statSync(packageJsonPath);

  return {
    packageName: DIAGNOSTICS_OTEL_PACKAGE_NAME,
    packageVersion: packageJson.version,
    packageJsonSize: packageJsonStat.size,
    packageJsonMtimeMs: packageJsonStat.mtimeMs,
    manifestSize: manifestStat.size,
    manifestMtimeMs: manifestStat.mtimeMs,
  };
};

export const resolveDiagnosticsOtelStateProjectPaths = (
  stateDir: string,
): DiagnosticsOtelStateProjectPaths => {
  const projectDir = path.join(stateDir, 'npm', 'projects', STATE_NPM_PROJECT_NAME);
  const packageDir = path.join(projectDir, 'node_modules', '@openclaw', 'diagnostics-otel');

  return {
    projectDir,
    packageDir,
    projectPackageJsonPath: path.join(projectDir, 'package.json'),
    syncMarkerPath: path.join(projectDir, SYNC_MARKER_FILE),
  };
};

export const findPreinstalledDiagnosticsOtelSourceDir = (runtimeRoot: string): string | null => {
  const candidates = [
    path.join(runtimeRoot, PREINSTALLED_EXTENSIONS_DIR, DIAGNOSTICS_OTEL_PLUGIN_ID),
    path.join(runtimeRoot, 'third-party-extensions', DIAGNOSTICS_OTEL_PLUGIN_ID),
    path.join(runtimeRoot, 'dist', 'extensions', DIAGNOSTICS_OTEL_PLUGIN_ID),
  ];

  for (const candidate of candidates) {
    if (isDirectory(candidate) && buildSourceSignature(candidate)) {
      return candidate;
    }
  }

  return null;
};

const writeProjectPackageJson = (
  projectPackageJsonPath: string,
  packageVersion: string,
): void => {
  const projectPackageJson = {
    private: true,
    name: STATE_PROJECT_PACKAGE_NAME,
    version: '0.0.0',
    dependencies: {
      [DIAGNOSTICS_OTEL_PACKAGE_NAME]: packageVersion,
    },
  };

  fs.writeFileSync(
    projectPackageJsonPath,
    `${JSON.stringify(projectPackageJson, null, 2)}\n`,
    'utf8',
  );
};

const shouldSkipSync = (
  paths: DiagnosticsOtelStateProjectPaths,
  sourceDir: string,
  sourceSignature: SourceSignature,
): boolean => {
  if (!fs.existsSync(path.join(paths.packageDir, 'openclaw.plugin.json'))) {
    return false;
  }

  const marker = readJsonFile<SourceSignature & { sourceDir?: unknown }>(paths.syncMarkerPath);
  return marker?.sourceDir === sourceDir
    && marker.packageName === sourceSignature.packageName
    && marker.packageVersion === sourceSignature.packageVersion
    && marker.packageJsonSize === sourceSignature.packageJsonSize
    && marker.packageJsonMtimeMs === sourceSignature.packageJsonMtimeMs
    && marker.manifestSize === sourceSignature.manifestSize
    && marker.manifestMtimeMs === sourceSignature.manifestMtimeMs;
};

export const syncDiagnosticsOtelStateNpmProject = (
  runtimeRoot: string,
  stateDir: string,
): DiagnosticsOtelStateSyncResult => {
  const paths = resolveDiagnosticsOtelStateProjectPaths(stateDir);
  const sourceDir = findPreinstalledDiagnosticsOtelSourceDir(runtimeRoot);
  if (!sourceDir) {
    return {
      synced: false,
      skippedReason: 'missing-source',
      projectDir: paths.projectDir,
      packageDir: paths.packageDir,
    };
  }

  const sourceSignature = buildSourceSignature(sourceDir);
  if (!sourceSignature) {
    return {
      synced: false,
      skippedReason: 'invalid-source',
      sourceDir,
      projectDir: paths.projectDir,
      packageDir: paths.packageDir,
    };
  }

  fs.mkdirSync(path.dirname(paths.packageDir), { recursive: true });
  fs.mkdirSync(paths.projectDir, { recursive: true });

  if (shouldSkipSync(paths, sourceDir, sourceSignature)) {
    return {
      synced: false,
      skippedReason: 'up-to-date',
      sourceDir,
      projectDir: paths.projectDir,
      packageDir: paths.packageDir,
    };
  }

  fs.rmSync(paths.packageDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, paths.packageDir, { recursive: true, force: true });
  writeProjectPackageJson(paths.projectPackageJsonPath, sourceSignature.packageVersion);
  fs.writeFileSync(
    paths.syncMarkerPath,
    `${JSON.stringify({ sourceDir, ...sourceSignature }, null, 2)}\n`,
    'utf8',
  );

  return {
    synced: true,
    sourceDir,
    projectDir: paths.projectDir,
    packageDir: paths.packageDir,
  };
};
