/**
 * beforePack hook for electron-builder.
 *
 * pnpm uses directory junctions for workspace packages and native modules.
 * electron-builder resolves junctions to their real paths when walking
 * node_modules (for both `files` collection AND `asarUnpack` glob matching),
 * then rejects any file whose real path is outside the app directory.
 *
 * Strategy:
 *   - @ieom/server and @ieomlabs/shared: replaced with minimal stubs —
 *     they are not needed at runtime since the server is bundled into
 *     dist/server-bundle.mjs.
 *   - better-sqlite3, bindings, file-uri-to-path: replaced with real copies
 *     (native binary + its runtime deps must be present as real directories).
 */

const fs = require('fs');
const path = require('path');

const desktopNodeModules = path.join(__dirname, '..', 'node_modules');

// Workspace package junctions replaced with minimal stubs
const STUB_PACKAGES = [
  {
    junction: path.join(desktopNodeModules, '@ieom', 'server'),
    exports: { '.': './dist/index.js', './desktop-entry': './dist/desktop-entry.js' },
  },
  {
    junction: path.join(desktopNodeModules, '@ieomlabs', 'shared'),
    exports: { '.': './dist/index.js' },
  },
];

// Native binary packages — must be real directory copies, not junctions.
// `bindings` and `file-uri-to-path` are runtime deps of better-sqlite3.
const NATIVE_PACKAGE_NAMES = [
  'better-sqlite3',
  'bindings',
  'file-uri-to-path',
];

/**
 * Recursively copy a directory, resolving any junctions/symlinks to real paths.
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (e) {
    console.warn(`[beforePack] cannot read ${src}: ${e.message}`);
    return;
  }

  for (const entry of entries) {
    if (entry.name === '.git') continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    let resolvedSrc = srcPath;
    let isDir = entry.isDirectory();

    if (entry.isSymbolicLink()) {
      try {
        resolvedSrc = fs.realpathSync(srcPath);
        isDir = fs.statSync(resolvedSrc).isDirectory();
      } catch {
        continue;
      }
    } else if (isDir) {
      try { resolvedSrc = fs.realpathSync(srcPath); } catch { /* keep srcPath */ }
    }

    if (isDir) {
      copyDir(resolvedSrc, destPath);
    } else {
      try {
        fs.copyFileSync(resolvedSrc, destPath);
      } catch (e) {
        console.warn(`[beforePack] cannot copy ${resolvedSrc}: ${e.message}`);
      }
    }
  }
}

/**
 * Replace a junction with a minimal stub so electron-builder won't follow it.
 * The stub satisfies Node.js package resolution but contains no real code —
 * the server is already bundled into dist/server-bundle.mjs.
 */
function writeStub(junctionPath, exportsMap) {
  fs.rmSync(junctionPath, { recursive: true, force: true });
  fs.mkdirSync(path.join(junctionPath, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(junctionPath, 'package.json'),
    JSON.stringify({ name: path.basename(junctionPath), version: '0.0.0', exports: exportsMap }, null, 2)
  );
  for (const [, target] of Object.entries(exportsMap)) {
    const stubFile = path.join(junctionPath, target);
    fs.mkdirSync(path.dirname(stubFile), { recursive: true });
    if (!fs.existsSync(stubFile)) {
      fs.writeFileSync(stubFile, '// stub — replaced by server-bundle.mjs at runtime\n');
    }
  }
}

/**
 * Find the real path for a package in the pnpm virtual store.
 * Looks first in the desktop's own node_modules (as a junction to resolve),
 * then searches the root .pnpm store directly.
 */
function findRealPackagePath(pkgName) {
  const localJunction = path.join(desktopNodeModules, pkgName);
  if (fs.existsSync(localJunction)) {
    try { return fs.realpathSync(localJunction); } catch { /* fall through */ }
  }

  // Search pnpm virtual store: node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>
  const pnpmStore = path.join(__dirname, '..', '..', '..', 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmStore)) return null;

  const entries = fs.readdirSync(pnpmStore);
  const prefix = pkgName.replace('/', '+') + '@';
  const match = entries
    .filter(e => e.startsWith(prefix))
    .sort()
    .pop(); // take latest version

  if (match) {
    const candidate = path.join(pnpmStore, match, 'node_modules', pkgName);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/** @param {import('app-builder-lib').BeforePackContext} context */
exports.default = async function beforePack(context) {
  // 1. Replace workspace junctions with stubs
  for (const pkg of STUB_PACKAGES) {
    const stat = fs.lstatSync(pkg.junction, { throwIfNoEntry: false });
    if (!stat) {
      console.log(`[beforePack] ${path.basename(pkg.junction)} not found, skipping`);
      continue;
    }
    console.log(`[beforePack] stubbing: ${path.basename(pkg.junction)}`);
    writeStub(pkg.junction, pkg.exports);
    console.log(`[beforePack] stubbed: ${path.basename(pkg.junction)}`);
  }

  // 2. Replace native package junctions with real copies
  for (const pkgName of NATIVE_PACKAGE_NAMES) {
    const destPath = path.join(desktopNodeModules, pkgName);
    const stat = fs.lstatSync(destPath, { throwIfNoEntry: false });

    // Resolve the real source path
    const realSrc = findRealPackagePath(pkgName);

    if (!realSrc) {
      console.log(`[beforePack] ${pkgName} not found in pnpm store, skipping`);
      continue;
    }

    const isJunction = stat && (() => {
      try { return fs.realpathSync(destPath) !== destPath; } catch { return false; }
    })();

    if (!stat || isJunction || (stat && stat.isSymbolicLink())) {
      console.log(`[beforePack] resolving native: ${pkgName}`);
      if (stat) fs.rmSync(destPath, { recursive: true, force: true });
      copyDir(realSrc, destPath);
      console.log(`[beforePack] done: ${pkgName}`);
    } else {
      console.log(`[beforePack] ${pkgName} already a real directory, skipping`);
    }
  }
};
