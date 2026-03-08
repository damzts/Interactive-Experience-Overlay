import type { AppConfig } from '../types/scene.js'
import { STATE } from '../types/state.js'

export const DEFAULT_CONFIG: AppConfig = {
  scenes: {
    LOBBY: {
      id: 'LOBBY',
      label: 'LOBBY',
      backgroundOpaque: true,
      sources: [
        {
          id: 'lobby-bg',
          pluginType: 'image-slideshow',
          config: { source: 'scraped-games', interval: 8, transition: 'crossfade' },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 0,
          visible: true,
        },
        {
          id: 'lobby-crt',
          pluginType: 'crt-effect',
          config: { scanlineIntensity: 0.25, flickerRate: 0.015, vignetteStrength: 0.5 },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 5,
          visible: true,
        },
      ],
    },
    GAMEPLAY: {
      id: 'GAMEPLAY',
      label: 'GAMEPLAY',
      backgroundOpaque: false,
      sources: [
        {
          id: 'gameplay-crt',
          pluginType: 'crt-effect',
          config: { scanlineIntensity: 0.12, flickerRate: 0.008, vignetteStrength: 0.2 },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 5,
          visible: true,
        },
      ],
    },
    TV: {
      id: 'TV',
      label: 'TV MODE',
      backgroundOpaque: true,
      sources: [
        {
          id: 'tv-bg',
          pluginType: 'image-slideshow',
          config: { source: 'scraped-games', interval: 4, transition: 'cut' },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 0,
          visible: true,
        },
        {
          id: 'tv-crt',
          pluginType: 'crt-effect',
          config: { scanlineIntensity: 0.5, flickerRate: 0.04, vignetteStrength: 0.65 },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 5,
          visible: true,
        },
        {
          id: 'tv-label',
          pluginType: 'text-widget',
          config: {
            content: '[ CHANNEL 2 — ON AIR ]',
            font: 'vt323',
            fontSize: 28,
            color: '#00ff88',
            typewriterMode: false,
          },
          position: { x: 40, y: 40, width: 500, height: 50 },
          zIndex: 10,
          visible: true,
        },
      ],
    },
    MUSIC: {
      id: 'MUSIC',
      label: 'MUSIC.exe',
      backgroundOpaque: true,
      sources: [
        {
          id: 'music-crt',
          pluginType: 'crt-effect',
          config: { scanlineIntensity: 0.3, flickerRate: 0.02, vignetteStrength: 0.4 },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 5,
          visible: true,
        },
        {
          id: 'music-label',
          pluginType: 'text-widget',
          config: {
            content: 'MUSIC.exe — LOADING...',
            font: 'vt323',
            fontSize: 36,
            color: '#ffaa00',
            typewriterMode: true,
          },
          position: { x: 760, y: 500, width: 400, height: 60 },
          zIndex: 10,
          visible: true,
        },
      ],
    },
    ARCHIVE: {
      id: 'ARCHIVE',
      label: 'ARCHIVE.exe',
      backgroundOpaque: true,
      sources: [
        {
          id: 'archive-crt',
          pluginType: 'crt-effect',
          config: { scanlineIntensity: 0.3, flickerRate: 0.02, vignetteStrength: 0.4 },
          position: { x: 0, y: 0, width: 1920, height: 1080 },
          zIndex: 5,
          visible: true,
        },
        {
          id: 'archive-label',
          pluginType: 'text-widget',
          config: {
            content: 'ARCHIVE.exe — READING MEMORY...',
            font: 'vt323',
            fontSize: 36,
            color: '#00aaff',
            typewriterMode: true,
          },
          position: { x: 660, y: 500, width: 600, height: 60 },
          zIndex: 10,
          visible: true,
        },
      ],
    },
  },

  applications: [
    {
      id: 'game',
      label: 'GAME.exe',
      icon: '🎮',
      targetSceneId: STATE.GAMEPLAY,
      transitionType: 'lobby-to-gameplay',
    },
    {
      id: 'tv',
      label: 'TV.exe',
      icon: '📺',
      targetSceneId: STATE.TV,
      transitionType: 'lobby-to-tv',
    },
    {
      id: 'music',
      label: 'MUSIC.exe',
      icon: '🎵',
      targetSceneId: STATE.MUSIC,
      transitionType: 'default',
    },
    {
      id: 'archive',
      label: 'ARCHIVE.exe',
      icon: '📁',
      targetSceneId: STATE.ARCHIVE,
      transitionType: 'default',
    },
  ],

  keybinds: {
    obs: {
      F1: 'scene:gameplay',
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F5: 'scene:tv',
      F6: 'scene:lobby',
      Escape: 'panic',
    },
    admin: {
      F1: 'scene:gameplay',
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F5: 'scene:tv',
      F6: 'scene:lobby',
      Escape: 'panic',
    },
  },

  obs: {
    url: 'ws://localhost:4455',
    password: '',
  },

  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.7,
    musicVolume: 0.4,
  },

  overlayStyle: {
    background: {
      type: 'gradient',
      color: '#000000',
      gradient: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)',
      imageUrl: '',
      videoUrl: '',
      pattern: 'none',
      opacity: 1,
      blur: 0,
    },
    effects: {
      crt: true,
      noise: false,
      vignette: true,
      flicker: false,
      chromatic: false,
      scanlineOpacity: 0.18,
      noiseOpacity: 0.06,
      vignetteStrength: 0.65,
    },
    particles: {
      enabled: false,
      preset: 'none',
      density: 0.5,
      speed: 0.4,
    },
    fontFamily: 'default',
    accentColor: '#00ff41',
    textColor: '#ffffff',
  },
}
