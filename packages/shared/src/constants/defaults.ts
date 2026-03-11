import type { AppConfig } from '../types/scene.js'
import { STATE, OVERLAY_EVENT } from '../types/state.js'

export const DEFAULT_CONFIG: AppConfig = {
  scenes: {
    LOBBY: {
      id: 'LOBBY',
      label: 'LOBBY',
      backgroundOpaque: true,
      // Lobby = 3D room (R3F ThreeBackground plugin — NOT the Win98 desktop).
      // The desktop layer is hidden in LOBBY state; only the 3D room renders here.
      sources: [],
      lobbyConfig: {
        ambientColor: '#1e1a3a',
        ambientIntensity: 0.28,
        fogColor: '#080810',
        fogNear: 6,
        fogFar: 22,
        wallColor: '#0f0f16',
        floorColor: '#0d0d14',
        floorReflectivity: 0.6,
        crtGlowColor: '#00c8e0',
        neonStrips: true,
        neonColors: ['#00c8ff', '#8000ff'],
        dustMotes: true,
        cameraFov: 62,
        starsCount: 400,
      },
    },

    DESKTOP: {
      id: 'DESKTOP',
      label: 'DESKTOP',
      backgroundOpaque: true,
      // Desktop = Win98 OS layer (shown via #desktop-layer CSS, not a source plugin).
      // Sources layer is empty — the desktop canvas owns this state visually.
      sources: [],
      style: {
        background: {
          type: 'none',
          color: '#000000',
          gradient: 'linear-gradient(135deg, #0c0c1e 0%, #1a0533 50%, #0c0c1e 100%)',
          imageUrl: '',
          videoUrl: '',
          pattern: 'none',
          opacity: 0,
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
    },
  },

  applications: [
    {
      id: 'browser',
      label: 'Browser.exe',
      icon: '🌐',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 16 },
      iconSize: 'normal' as const,
    },
    {
      id: 'music',
      label: 'MUSIC.exe',
      icon: '🎵',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 96 },
      iconSize: 'normal' as const,
    },
    {
      id: 'archive',
      label: 'ARCHIVE.exe',
      icon: '📖',
      appType: 'widget' as const,
      targetSceneId: STATE.DESKTOP,
      transitionType: 'instant',
      iconPosition: { x: 16, y: 176 },
      iconSize: 'normal' as const,
    },
  ],

  keybinds: {
    obs: {
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F6: 'scene:desktop',
      F7: 'scene:lobby',
      Escape: 'panic',
    },
    admin: {
      F2: 'overlay:death',
      F3: 'overlay:revive',
      F4: 'overlay:victory',
      F6: 'scene:desktop',
      F7: 'scene:lobby',
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

  desktopConfig: {
    defaultIconSize: 'normal',
    autoArrangeIcons: false,
    screenSaver: {
      enabled: false,
      timeoutMinutes: 5,
      preset: 'starfield',
    },
    systemSounds: {
      startup: '',
      error: '',
      notify: '',
      click: '',
      close: '',
    },
  },

  events: [
    { id: OVERLAY_EVENT.DEATH,          label: 'DEATH',    icon: '💀', color: 'text-red-400',     desc: 'Red vignette + YOU DIED',           effects: [{ type: 'death-overlay',   cfg: {} }],                                                                                             auto: { enabled: false, mode: 'interval', intervalMin: 20, idleMin: 5 } },
    { id: OVERLAY_EVENT.VICTORY,        label: 'VICTORY',  icon: '🏆', color: 'text-yellow-400',  desc: 'Win98 dialog: MISSION.LOG saved',   effects: [{ type: 'victory-overlay', cfg: {} }],                                                                                             auto: { enabled: false, mode: 'interval', intervalMin: 30, idleMin: 5 } },
    { id: OVERLAY_EVENT.REVIVE,         label: 'REVIVE',   icon: '❤',  color: 'text-emerald-400', desc: 'Terminal: Restarting process...',   effects: [{ type: 'revive-overlay',  cfg: {} }],                                                                                             auto: { enabled: false, mode: 'interval', intervalMin: 25, idleMin: 5 } },
    { id: OVERLAY_EVENT.NETWORK_GLITCH, label: 'GLITCH',   icon: '📡', color: 'text-purple-400',  desc: 'Full-screen artifact burst',        effects: [{ type: 'network-glitch',  cfg: { message: '[ NETWORK INTERRUPTION ]', duration: 2 } }],                                          auto: { enabled: false, mode: 'interval', intervalMin: 15, idleMin: 5 } },
    { id: 'idle-floaties',              label: 'FLOATIES', icon: '✨',  color: 'text-cyan-400',    desc: 'Glowing symbols drift over screen', effects: [{ type: 'floaties',         cfg: { count: 10, duration: 10, speed: 1.0 } }],                                                     auto: { enabled: false, mode: 'idle',     intervalMin: 15, idleMin: 5 } },
  ],

  mediaLibrary: [],
}
