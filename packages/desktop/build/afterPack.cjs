const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  const appDir = path.join(context.appOutDir, 'resources', 'app');
  const target = path.join(appDir, 'node_modules', '@shinyoshiaki', 'binary-data', 'src', 'node_modules');

  if (fs.existsSync(target)) return;

  // Find the source in pnpm store or local node_modules
  const localSrc = path.join(__dirname, '..', 'node_modules', '@shinyoshiaki', 'binary-data', 'src', 'node_modules');
  const src = fs.existsSync(localSrc)
    ? localSrc
    : path.join(context.packager.projectDir, 'node_modules', '@shinyoshiaki', 'binary-data', 'src', 'node_modules');

  if (fs.existsSync(src)) {
    fs.cpSync(src, target, { recursive: true });
    console.log('  • afterPack: copied binary-data/src/node_modules');
  } else {
    // Resolve through require.resolve
    try {
      const binaryDataPkg = require.resolve('@shinyoshiaki/binary-data/package.json', { paths: [context.packager.projectDir] });
      const binaryDataDir = path.dirname(binaryDataPkg);
      const resolvedSrc = path.join(binaryDataDir, 'src', 'node_modules');
      if (fs.existsSync(resolvedSrc)) {
        fs.cpSync(resolvedSrc, target, { recursive: true });
        console.log('  • afterPack: copied binary-data/src/node_modules (resolved)');
      }
    } catch (err) {
      console.error('[afterPack] Failed to resolve binary-data/src/node_modules:', err);
      throw err;
    }
  }
};
