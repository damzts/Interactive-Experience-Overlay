import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import type { Scene } from '@ieomlabs/shared'
import { initDesktopDatabase, closeDesktopDatabase } from '../../desktop-db.js'
import { SceneRepository } from '../SceneRepository.js'

describe('SceneRepository — introSteps/exitSteps', () => {
  let db: ReturnType<typeof initDesktopDatabase> | undefined

  afterEach(() => {
    if (db) closeDesktopDatabase(db)
    db = undefined
  })

  it('round-trips a scene with populated introSteps/exitSteps via upsert + load', () => {
    db = initDesktopDatabase(':memory:')
    const repo = new SceneRepository(db)

    const scene: Scene = {
      id: 'scene-a',
      label: 'Scene A',
      backgroundOpaque: false,
      windows: [],
      introSteps: [{ effect: { type: 'confetti', cfg: {} }, waitMs: 1000 }],
      exitSteps: [{ emitSignal: { event: 'scene:left' } }],
    }

    repo.upsert(scene)
    const loaded = repo.load()

    expect(loaded['scene-a']?.introSteps).toEqual(scene.introSteps)
    expect(loaded['scene-a']?.exitSteps).toEqual(scene.exitSteps)
  })

  it('round-trips a scene with populated introSteps/exitSteps via save + load', () => {
    db = initDesktopDatabase(':memory:')
    const repo = new SceneRepository(db)

    const scenes: Record<string, Scene> = {
      'scene-b': {
        id: 'scene-b',
        label: 'Scene B',
        backgroundOpaque: false,
        windows: [],
        introSteps: [{ waitForSignal: { event: 'audio:beat', timeoutMs: 5000 } }],
        exitSteps: [{ parallel: [{ effect: { type: 'confetti', cfg: {} } }] }],
      },
    }

    repo.save(scenes)
    const loaded = repo.load()

    expect(loaded['scene-b']?.introSteps).toEqual(scenes['scene-b'].introSteps)
    expect(loaded['scene-b']?.exitSteps).toEqual(scenes['scene-b'].exitSteps)
  })

  it('loads undefined introSteps/exitSteps for a scene that never set them', () => {
    db = initDesktopDatabase(':memory:')
    const repo = new SceneRepository(db)

    repo.upsert({ id: 'scene-c', label: 'Scene C', backgroundOpaque: false, windows: [] })
    const loaded = repo.load()

    expect(loaded['scene-c']?.introSteps).toBeUndefined()
    expect(loaded['scene-c']?.exitSteps).toBeUndefined()
  })

  it('loads legacy rows (pre-migration, no intro_steps_json/exit_steps_json columns) without throwing', () => {
    // Simulate a DB created before this migration: scenes table lacks the
    // new columns entirely. load() must not throw and should fall back to
    // undefined for both fields.
    const legacyDb = new Database(':memory:')
    legacyDb.exec(`
      CREATE TABLE scenes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        background_opaque INTEGER NOT NULL DEFAULT 0,
        windows_json TEXT NOT NULL DEFAULT '[]',
        style_json TEXT,
        intro_sequence_id TEXT,
        exit_sequence_id TEXT,
        ambient_track TEXT,
        show_desktop INTEGER NOT NULL DEFAULT 0
      );
    `)
    legacyDb.prepare(
      "INSERT INTO scenes (id, label, background_opaque, windows_json) VALUES ('legacy-1', 'Legacy', 0, '[]')"
    ).run()

    const repo = new SceneRepository(legacyDb)
    const loaded = repo.load()

    expect(loaded['legacy-1']).toBeDefined()
    expect(loaded['legacy-1']?.introSteps).toBeUndefined()
    expect(loaded['legacy-1']?.exitSteps).toBeUndefined()

    legacyDb.close()
  })
})
