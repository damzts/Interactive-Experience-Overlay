import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { Server as SocketIOServer } from 'socket.io'
import type { SpotifyPlaylist, SpotifyStatePayload } from '@ieomlabs/shared'
import type { IConfigService } from '../../kernel/managers/config.js'

interface SpotifyRouteOptions extends FastifyPluginOptions {
  configService: IConfigService
  io: SocketIOServer
}

function extractPlaylistId(input: string): string | null {
  input = input.trim()
  const urlMatch = input.match(/spotify\.com\/playlist\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1] ?? null
  const uriMatch = input.match(/spotify:playlist:([A-Za-z0-9]+)/)
  if (uriMatch) return uriMatch[1] ?? null
  if (/^[A-Za-z0-9]{10,}$/.test(input)) return input
  return null
}

function emitSpotifyState(io: SocketIOServer, playlist: SpotifyPlaylist | undefined) {
  const payload: SpotifyStatePayload = {
    activePlaylistId: playlist?.id,
    activePlaylistName: playlist?.name,
  }
  io.emit('spotify:state', payload)
}

export async function spotifyRoute(fastify: FastifyInstance, opts: SpotifyRouteOptions) {
  const { configService, io } = opts

  const getSpotifyCfg = () => (configService.cachedConfig?.spotify ?? { playlists: [] })

  fastify.get('/api/spotify', async (_req, reply) => {
    const cfg = getSpotifyCfg()
    return reply.send({ ok: true, playlists: cfg.playlists, activePlaylistId: cfg.activePlaylistId })
  })

  fastify.post<{ Body: { id?: string; url?: string; name: string } }>('/api/spotify/playlists', async (req, reply) => {
    const { id: rawId, url, name } = req.body
    const resolved = extractPlaylistId(rawId ?? url ?? '')
    if (!resolved) return reply.status(400).send({ ok: false, error: 'Invalid playlist ID or URL' })
    if (!name?.trim()) return reply.status(400).send({ ok: false, error: 'Name is required' })

    const cfg = getSpotifyCfg()
    if (cfg.playlists.some((p) => p.id === resolved)) {
      return reply.status(409).send({ ok: false, error: 'Playlist already added' })
    }

    const entry: SpotifyPlaylist = { id: resolved, name: name.trim() }
    await configService.patchSpotifyConfig({ ...cfg, playlists: [...cfg.playlists, entry] })
    return reply.send({ ok: true, playlist: entry })
  })

  fastify.delete<{ Params: { id: string } }>('/api/spotify/playlists/:id', async (req, reply) => {
    const { id } = req.params
    const cfg = getSpotifyCfg()
    const playlists = cfg.playlists.filter((p) => p.id !== id)
    const wasActive = cfg.activePlaylistId === id
    const activePlaylistId = wasActive ? playlists[0]?.id : cfg.activePlaylistId
    await configService.patchSpotifyConfig({ ...cfg, playlists, activePlaylistId })
    if (wasActive) emitSpotifyState(io, playlists[0])
    return reply.send({ ok: true })
  })

  fastify.put<{ Body: { playlistId: string | null } }>('/api/spotify/active', async (req, reply) => {
    const { playlistId } = req.body
    const cfg = getSpotifyCfg()
    const playlist = playlistId ? cfg.playlists.find((p) => p.id === playlistId) : undefined
    await configService.patchSpotifyConfig({ ...cfg, activePlaylistId: playlist?.id })
    emitSpotifyState(io, playlist)
    return reply.send({ ok: true, activePlaylistId: playlist?.id, activePlaylistName: playlist?.name })
  })

  fastify.post<{ Body: { command: string; value?: number } }>('/api/spotify/control', async (req, reply) => {
    const { command, value } = req.body
    if (!command) return reply.status(400).send({ ok: false, error: 'command is required' })
    io.emit('spotify:control', { command: command as 'play-pause' | 'next' | 'prev' | 'stop' | 'volume', value })
    return reply.send({ ok: true })
  })
}
