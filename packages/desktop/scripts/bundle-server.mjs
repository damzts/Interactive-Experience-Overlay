#!/usr/bin/env node
/**
 * Bundle @ieom/server/desktop-entry into a single ESM file using esbuild.
 *
 * The server uses import.meta.url / import.meta.dirname extensively so the
 * output format must be ESM.  Many bundled dependencies use dynamic require()
 * internally; esbuild handles this with the __require shim when bundling for
 * Node in ESM mode.
 *
 * Only native .node binary modules are kept external.
 *
 * Output: packages/desktop/dist/server-bundle.mjs
 */

import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(__dirname, '../../server/src/desktop-entry.ts');
const outfile = path.resolve(__dirname, '../dist/server-bundle.mjs');

const externals = [
  'better-sqlite3',
  'mediasoup',
  'electron',
];

// Standard esbuild CJS-in-ESM shim — gives bundled CJS modules a working
// require(), __dirname, and __filename inside an ESM output file.
const banner = `
import { createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_fn } from 'path';
const require = createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_fn(__filename);
`.trimStart();

console.log('Bundling server...');
console.log('  entry :', serverEntry);
console.log('  output:', outfile);

await build({
  entryPoints: [serverEntry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile,
  external: externals,
  banner: { js: banner },
  alias: {
    '@ieomlabs/shared': path.resolve(__dirname, '../../shared/src/index.ts'),
    '@ieom/server': path.resolve(__dirname, '../../server/src'),
  },
  loader: {
    '.ts': 'ts',
    '.mts': 'ts',
    '.cts': 'ts',
  },
  // Force NODE_ENV=production at bundle time so pino skips the pino-pretty
  // transport entirely — the transport branch becomes dead code and is removed.
  // pino-pretty uses worker_threads to spawn a child process that resolves the
  // transport by name; that lookup cannot work inside an asar bundle.
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
  sourcemap: false,
  treeShaking: true,
});

console.log('Server bundle complete:', outfile);
