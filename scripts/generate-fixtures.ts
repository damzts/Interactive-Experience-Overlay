import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DEFAULT_CONFIG, DEFAULT_LOBBY_CONFIG } from '../packages/shared/src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '../data/fixtures')
mkdirSync(FIXTURES_DIR, { recursive: true })

writeFileSync(join(FIXTURES_DIR, 'default-config.json'), JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
writeFileSync(join(FIXTURES_DIR, 'default-applications.json'), JSON.stringify(DEFAULT_CONFIG.applications, null, 2), 'utf8')
writeFileSync(join(FIXTURES_DIR, 'default-scenes.json'), JSON.stringify(DEFAULT_CONFIG.scenes, null, 2), 'utf8')
writeFileSync(join(FIXTURES_DIR, 'default-lobby.json'), JSON.stringify(DEFAULT_LOBBY_CONFIG, null, 2), 'utf8')
writeFileSync(join(FIXTURES_DIR, 'default-events.json'), JSON.stringify(DEFAULT_CONFIG.sourceEvents, null, 2), 'utf8')

console.log(`[fixtures] Written to ${FIXTURES_DIR}`)
