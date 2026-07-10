import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { AppConfig } from '@ieomlabs/shared'
import type { DesktopConfigService } from '../../kernel/managers/config.js'
import {
  PRESET_BUNDLE_VERSION,
  packAssetsForSections,
  unpackAssetsFromBundle,
  type PresetBundle,
} from '../../services/PresetBundleService.js'

interface PresetsRouteOptions extends FastifyPluginOptions {
  configService: DesktopConfigService
}

export async function presetsRoute(app: FastifyInstance, opts: PresetsRouteOptions) {
  const { configService } = opts

  /** List all saved config presets */
  app.get('/api/presets', async () => {
    return { presets: configService.listPresets() }
  })

  /** Save the current config (or a subset of sections) as a new named preset */
  app.post<{ Body: { label: string; sectionKeys: Array<keyof AppConfig> } }>('/api/presets', async (req, reply) => {
    const { label, sectionKeys } = req.body
    if (!label || !Array.isArray(sectionKeys) || sectionKeys.length === 0) {
      return reply.code(400).send({ ok: false, error: 'label and sectionKeys are required' })
    }
    const preset = configService.savePreset(label, sectionKeys)
    return reply.send({ ok: true, preset })
  })

  /** Apply a saved preset, patching the live config */
  app.post<{ Params: { id: string } }>('/api/presets/:id/apply', async (req, reply) => {
    try {
      const config = await configService.applyPreset(req.params.id)
      return reply.send({ ok: true, config })
    } catch (err) {
      return reply.code(404).send({ ok: false, error: (err as Error).message })
    }
  })

  /** Delete a saved preset */
  app.delete<{ Params: { id: string } }>('/api/presets/:id', async (req, reply) => {
    configService.deletePreset(req.params.id)
    return reply.send({ ok: true })
  })

  /** Export a preset as a shareable bundle: the preset's config sections
   *  plus every /assets/... file they reference, base64-embedded so the
   *  whole thing travels as one JSON file with no broken paths for the
   *  person receiving it. */
  app.get<{ Params: { id: string } }>('/api/presets/:id/export', async (req, reply) => {
    const preset = configService.listPresets().find((p) => p.id === req.params.id)
    if (!preset) return reply.code(404).send({ ok: false, error: 'Preset not found' })

    const assets = packAssetsForSections(preset.sections)
    const bundle: PresetBundle = {
      bundleVersion: PRESET_BUNDLE_VERSION,
      preset: {
        id: preset.id,
        label: preset.label,
        sections: preset.sections,
        createdAt: preset.createdAt,
      },
      assets,
    }

    const fileSafeLabel = preset.label.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'preset'
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${fileSafeLabel}.ieompreset.json"`)
      .send(bundle)
  })

  /** Import a preset bundle produced by the export endpoint above: writes
   *  any embedded assets back under /assets/ (recreating their original
   *  paths so nothing breaks) and saves the config sections as a new
   *  preset the operator can then load. Raised bodyLimit (default Fastify
   *  limit is 1MB) since bundles embed base64 asset data. */
  app.post<{ Body: unknown }>('/api/presets/import', { bodyLimit: 200 * 1024 * 1024 }, async (req, reply) => {
    const body = req.body as Partial<PresetBundle> | undefined
    if (!body || typeof body !== 'object' || !body.preset || typeof body.preset !== 'object') {
      return reply.code(400).send({ ok: false, error: 'Invalid preset bundle' })
    }
    const { preset, assets } = body
    if (!preset.label || !preset.sections || typeof preset.sections !== 'object') {
      return reply.code(400).send({ ok: false, error: 'Bundle is missing a preset label or sections' })
    }

    const assetResult = Array.isArray(assets)
      ? unpackAssetsFromBundle(assets)
      : { written: 0, skipped: 0 }

    const sectionKeys = Object.keys(preset.sections) as Array<keyof AppConfig>
    const saved = configService.savePreset(preset.label, sectionKeys, preset.sections as Partial<AppConfig>)

    return reply.send({ ok: true, preset: saved, assets: assetResult })
  })
}
