#!/usr/bin/env node
/**
 * Downloads pre-rendered Winamp skin screenshot PNGs from the Internet Archive's
 * `winampskins` collection (the same upstream data skins.webamp.org is built on).
 * Each archive.org item already contains a fully composited skin screenshot, so no
 * .wsz parsing / BMP compositing / transparency-key handling is needed.
 *
 * Fan-submitted skins preserved on archive.org — fine for personal overlay
 * decoration, but per-skin redistribution rights are unclear.
 *
 * Usage: node scripts/download-winamp-skins.js [--count=1000] [--out=assets/images/winamp] [--concurrency=8]
 *
 * Duplicate skins (same image re-uploaded under a different archive.org identifier)
 * are detected via the file's md5 (reported directly in archive.org item metadata,
 * and computed locally for files already on disk) and skipped without downloading.
 */
import { mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const COUNT = Number(args.count ?? 1000)
const OUT_DIR = join(repoRoot, String(args.out ?? 'assets/images/winamp'))
const CONCURRENCY = Number(args.concurrency ?? 8)

mkdirSync(OUT_DIR, { recursive: true })

function md5(buf) {
  return createHash('md5').update(buf).digest('hex')
}

function seedSeenHashes() {
  const seen = new Set()
  for (const name of readdirSync(OUT_DIR)) {
    if (!name.endsWith('.png')) continue
    seen.add(md5(readFileSync(join(OUT_DIR, name))))
  }
  return seen
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

async function withRetry(fn, retries = 1) {
  try {
    return await fn()
  } catch (err) {
    if (retries <= 0) throw err
    await new Promise((r) => setTimeout(r, 500))
    return withRetry(fn, retries - 1)
  }
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function fetchTopIdentifiers(count) {
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent('collection:winampskins')}` +
    `&fl[]=identifier&sort[]=downloads+desc&rows=${count}&page=1&output=json`
  const data = await withRetry(() => fetchJson(url))
  return data.response.docs.map((d) => d.identifier)
}

async function downloadSkinArt(identifier, seenHashes) {
  const destPath = join(OUT_DIR, `${sanitize(identifier)}.png`)
  if (existsSync(destPath)) return { identifier, status: 'skipped' }

  const meta = await withRetry(() => fetchJson(`https://archive.org/metadata/${identifier}`))
  const files = meta.files ?? []
  const pngFile = files.find(
    (f) => f.format === 'PNG' && !/thumb/i.test(f.name)
  )
  if (!pngFile) return { identifier, status: 'no-png' }

  if (pngFile.md5) {
    if (seenHashes.has(pngFile.md5)) return { identifier, status: 'duplicate' }
    seenHashes.add(pngFile.md5)
  }

  const fileUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(pngFile.name)}`
  const res = await withRetry(async () => {
    const r = await fetch(fileUrl)
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r
  })
  const buf = Buffer.from(await res.arrayBuffer())

  if (!pngFile.md5 && seenHashes.has(md5(buf))) return { identifier, status: 'duplicate' }
  seenHashes.add(md5(buf))

  writeFileSync(destPath, buf)
  return { identifier, status: 'downloaded' }
}

async function runPool(items, worker, concurrency) {
  const results = []
  let cursor = 0
  let done = 0

  async function next() {
    while (cursor < items.length) {
      const idx = cursor++
      const item = items[idx]
      try {
        const result = await worker(item)
        results[idx] = result
      } catch (err) {
        results[idx] = { identifier: item, status: 'failed', error: err.message }
      }
      done++
      process.stdout.write(`\r${done}/${items.length} processed`)
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  await Promise.all(Array.from({ length: concurrency }, next))
  process.stdout.write('\n')
  return results
}

console.log(`Fetching top ${COUNT} Winamp skins by popularity (downloads desc)...`)
const identifiers = await fetchTopIdentifiers(COUNT)
console.log(`Got ${identifiers.length} identifiers.`)

const seenHashes = seedSeenHashes()
console.log(`Seeded ${seenHashes.size} known image hashes from ${OUT_DIR}.`)
console.log(`Downloading art to ${OUT_DIR} (concurrency=${CONCURRENCY})...`)

const results = await runPool(identifiers, (id) => downloadSkinArt(id, seenHashes), CONCURRENCY)

const summary = results.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1
  return acc
}, {})

console.log('\nDone.')
console.log(summary)

const failed = results.filter((r) => r.status === 'failed' || r.status === 'no-png')
if (failed.length) {
  console.log(`\n${failed.length} item(s) had issues:`)
  for (const f of failed.slice(0, 20)) {
    console.log(`  ${f.identifier}: ${f.status}${f.error ? ` (${f.error})` : ''}`)
  }
  if (failed.length > 20) console.log(`  ...and ${failed.length - 20} more`)
}
