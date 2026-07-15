#!/usr/bin/env node
/**
 * Ensures better-sqlite3 is prebuilt for plain Node.js (used by `pnpm dev`).
 *
 * Electron has its own internal Node with a different MODULE_VERSION (ABI).
 * pnpm installs one shared binary for the monorepo — whichever ran last
 * (server dev or desktop dev) wins. This script re-fetches the Node prebuilt
 * before starting the server so ABI 137 (Node 24) is always in place.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monoroot = path.resolve(__dirname, '..');

const sqlitePkg = path.resolve(
  monoroot,
  'node_modules', '.pnpm',
  'better-sqlite3@12.11.1',
  'node_modules', 'better-sqlite3'
);

const nodeVersion = process.version.replace('v', '');
const nodeAbi = process.versions.modules;

console.log(`[rebuild-sqlite] Ensuring better-sqlite3 prebuilt for Node ${process.version} (ABI ${nodeAbi})`);

const prebuildInstall = path.resolve(
  monoroot,
  'node_modules', '.pnpm', 'prebuild-install@7.1.3', 'node_modules', 'prebuild-install', 'bin.js'
);

try {
  execFileSync(
    process.execPath,
    [
      prebuildInstall,
      '--runtime', 'node',
      '--target', nodeVersion,
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
  console.error('[rebuild-sqlite] prebuild-install failed, falling back to node-gyp rebuild:', err.message);
  execFileSync(
    process.execPath,
    ['node_modules/.bin/node-gyp', 'rebuild', '--release'],
    { cwd: sqlitePkg, stdio: 'inherit' }
  );
}
