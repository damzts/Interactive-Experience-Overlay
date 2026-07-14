#!/usr/bin/env node
/**
 * Ensures better-sqlite3 is prebuilt for Electron's ABI (used by `pnpm dev:desktop`).
 *
 * Electron has its own internal Node with a different MODULE_VERSION (ABI 145)
 * than plain Node 24 (ABI 137). pnpm installs one shared binary — this script
 * re-fetches the Electron prebuilt before starting `electron .` so the right
 * ABI is always in place.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const monoroot = path.resolve(__dirname, '..', '..', '..');

const sqlitePkg = path.resolve(
  monoroot,
  'node_modules', '.pnpm',
  'better-sqlite3@12.11.1',
  'node_modules', 'better-sqlite3'
);

// Resolve installed Electron version
const electronPkg = require(path.resolve(
  monoroot,
  'node_modules', '.pnpm', 'electron@41.8.0',
  'node_modules', 'electron', 'package.json'
));
const electronVersion = electronPkg.version;

// Resolve ABI for this Electron version
const { getAbi } = require(path.resolve(
  monoroot,
  'node_modules', '.pnpm', 'node-abi@4.31.0',
  'node_modules', 'node-abi'
));
const electronAbi = getAbi(electronVersion, 'electron');

console.log(`[rebuild-sqlite] Ensuring better-sqlite3 prebuilt for Electron ${electronVersion} (ABI ${electronAbi})`);

const prebuildInstall = path.resolve(
  monoroot,
  'node_modules', '.pnpm', 'prebuild-install@7.1.3',
  'node_modules', 'prebuild-install', 'bin.js'
);

try {
  execFileSync(
    process.execPath,
    [
      prebuildInstall,
      '--runtime', 'electron',
      '--target', electronVersion,
      '--arch', process.arch,
      '--platform', process.platform,
      '--tag-prefix', 'v',
    ],
    {
      cwd: sqlitePkg,
      stdio: 'inherit',
      env: { ...process.env },
    }
  );
  console.log('[rebuild-sqlite] Done.');
} catch (err) {
  console.error('[rebuild-sqlite] prebuild-install failed:', err.message);
  console.error('[rebuild-sqlite] Falling back to node-gyp rebuild for Electron...');
  execFileSync(
    process.execPath,
    [
      path.resolve(monoroot, 'node_modules', '.pnpm', 'node-gyp@11.2.0', 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'),
      'rebuild',
      '--release',
      `--target=${electronVersion}`,
      '--dist-url=https://electronjs.org/headers',
      `--arch=${process.arch}`,
    ],
    { cwd: sqlitePkg, stdio: 'inherit' }
  );
}
