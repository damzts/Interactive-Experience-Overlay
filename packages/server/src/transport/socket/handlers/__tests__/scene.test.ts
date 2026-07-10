import { describe, it, expect } from 'vitest'
import type { AppConfig, Scene, SequenceStep } from '@ieomlabs/shared'
import { resolvePipelines } from '../scene.js'

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene',
    label: 'Scene',
    backgroundOpaque: false,
    windows: [],
    ...overrides,
  }
}

function makeConfig(scenes: Record<string, Scene>): AppConfig {
  return { scenes } as AppConfig
}

const SEQ_STEPS: SequenceStep[] = [{ effect: { type: 'confetti', cfg: {} } }]
const INLINE_INTRO_STEPS: SequenceStep[] = [{ emitSignal: { event: 'scene:entered' } }]
const INLINE_EXIT_STEPS: SequenceStep[] = [{ emitSignal: { event: 'scene:exited' } }]

describe('resolvePipelines', () => {
  it('resolves via existing Sequence id when introSequenceId/exitSequenceId are set', () => {
    const cfg = makeConfig({
      FROM: makeScene({ id: 'FROM', exitSequenceId: 'seq-exit' }),
      TO: makeScene({ id: 'TO', introSequenceId: 'seq-intro' }),
    })
    const getSequence = (id: string) => (id === 'seq-intro' || id === 'seq-exit' ? { steps: SEQ_STEPS } : undefined)

    const result = resolvePipelines(cfg, getSequence, 'FROM', 'TO')

    expect(result.intro).toEqual(SEQ_STEPS)
    expect(result.exit).toEqual(SEQ_STEPS)
  })

  it('falls back to scene-specific introSteps/exitSteps when no Sequence id is set', () => {
    const cfg = makeConfig({
      FROM: makeScene({ id: 'FROM', exitSteps: INLINE_EXIT_STEPS }),
      TO: makeScene({ id: 'TO', introSteps: INLINE_INTRO_STEPS }),
    })
    const getSequence = () => undefined

    const result = resolvePipelines(cfg, getSequence, 'FROM', 'TO')

    expect(result.intro).toEqual(INLINE_INTRO_STEPS)
    expect(result.exit).toEqual(INLINE_EXIT_STEPS)
  })

  it('prioritizes the existing Sequence over inline steps when both are set', () => {
    const cfg = makeConfig({
      FROM: makeScene({ id: 'FROM', exitSequenceId: 'seq-exit', exitSteps: INLINE_EXIT_STEPS }),
      TO: makeScene({ id: 'TO', introSequenceId: 'seq-intro', introSteps: INLINE_INTRO_STEPS }),
    })
    const getSequence = (id: string) => (id === 'seq-intro' || id === 'seq-exit' ? { steps: SEQ_STEPS } : undefined)

    const result = resolvePipelines(cfg, getSequence, 'FROM', 'TO')

    expect(result.intro).toEqual(SEQ_STEPS)
    expect(result.exit).toEqual(SEQ_STEPS)
    expect(result.intro).not.toEqual(INLINE_INTRO_STEPS)
    expect(result.exit).not.toEqual(INLINE_EXIT_STEPS)
  })

  it('returns empty arrays when neither a Sequence id nor inline steps are set', () => {
    const cfg = makeConfig({
      FROM: makeScene({ id: 'FROM' }),
      TO: makeScene({ id: 'TO' }),
    })
    const getSequence = () => undefined

    const result = resolvePipelines(cfg, getSequence, 'FROM', 'TO')

    expect(result.intro).toEqual([])
    expect(result.exit).toEqual([])
  })

  it('returns empty arrays when a Sequence id is set but the Sequence no longer exists', () => {
    const cfg = makeConfig({
      FROM: makeScene({ id: 'FROM', exitSequenceId: 'missing', exitSteps: INLINE_EXIT_STEPS }),
      TO: makeScene({ id: 'TO' }),
    })
    const getSequence = () => undefined

    const result = resolvePipelines(cfg, getSequence, 'FROM', 'TO')

    // introSequenceId/exitSequenceId being set means the Sequence lookup is
    // authoritative even if it's missing — it does not fall back to inline steps.
    expect(result.exit).toEqual([])
  })
})
