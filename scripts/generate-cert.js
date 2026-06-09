#!/usr/bin/env node
/**
 * Generates a self-signed TLS certificate for LAN dev (HTTPS / WebRTC getUserMedia).
 * Output: scripts/certs/cert.pem  scripts/certs/key.pem
 *
 * Usage: node scripts/generate-cert.js
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'certs')
mkdirSync(outDir, { recursive: true })

// selfsigned is installed in packages/server — resolve from there
const require = createRequire(join(__dirname, '..', 'packages', 'server', 'package.json'))
const selfsigned = require('selfsigned')

const pems = await selfsigned.generate(
  [{ name: 'commonName', value: 'ieom-lan-dev' }],
  {
    days: 825,
    keySize: 2048,
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  }
)

writeFileSync(join(outDir, 'cert.pem'), pems.cert)
writeFileSync(join(outDir, 'key.pem'), pems.private)

console.log('✓ Certificate written to scripts/certs/')
console.log('  On each LAN device: open https://<your-ip>:3000 and accept the security warning.')
