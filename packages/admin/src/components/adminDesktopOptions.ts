import type { DesktopConfig } from '@ieom/shared'

export const GOOGLE_FONTS = [
  { name: 'System Default', css: 'default' },
  { name: 'Press Start 2P', css: 'Press Start 2P' },
  { name: 'VT323', css: 'VT323' },
  { name: 'Orbitron', css: 'Orbitron' },
  { name: 'Share Tech Mono', css: 'Share Tech Mono' },
  { name: 'Rajdhani', css: 'Rajdhani' },
  { name: 'Audiowide', css: 'Audiowide' },
  { name: 'Electrolize', css: 'Electrolize' },
]

export const SCREENSAVER_PRESETS: { id: DesktopConfig['screenSaver']['preset']; label: string }[] = [
  { id: 'starfield', label: 'Starfield' },
  { id: 'flying-windows', label: 'Flying Windows' },
  { id: 'marquee', label: 'Marquee Text' },
  { id: 'pipes', label: 'Pipes 3D' },
  { id: 'gallery-scroll', label: 'Game Gallery' },
  { id: 'blank', label: 'Black Screen' },
]

export const DESKTOP_THEMES: Array<{
  id: DesktopConfig['theme']
  label: string
  description: string
}> = [
  { id: 'win98', label: 'Win98', description: 'Classic desktop chrome with utilitarian bevels, neutral panels, and retro shell clarity.' },
  { id: 'frutiger aero', label: 'Frutiger Aero', description: 'Glossy glass surfaces, aquatic light, and soft optimistic UI polish.' },
  { id: 'y2k candy', label: 'Y2K Candy', description: 'Bright plastic color, pop-tech gradients, and playful portal-era gloss.' },
  { id: 'midnight chrome', label: 'Midnight Chrome', description: 'Dark metallic shell styling with cool reflections and broadcast-night weight.' },
  { id: 'sunset boulevard', label: 'Sunset Boulevard', description: 'Warm nightlife tones, hot highlights, and showtime desktop energy.' },
  { id: 'coastal glass', label: 'Coastal Glass', description: 'Airy glass chrome with sea-light softness and open, bright framing.' },
  { id: 'amber terminal', label: 'Amber Terminal', description: 'CRT utility warmth, terminal glow, and focused monochrome control-room mood.' },
  { id: 'custom', label: 'Custom', description: 'Use your current font and color overrides as a hand-tuned desktop shell profile.' },
]

export const WIDGET_SKINS: Array<{
  id: DesktopConfig['widgetTheme']['skin']
  label: string
  description: string
}> = [
  { id: 'metalheart', label: 'Metalheart', description: 'Brushed alloy shell with hot-pink hardware and arcade steel highlights.' },
  { id: 'genx soft club', label: 'GenX Soft Club', description: 'Pastel nightclub plastic with glossy mint and bubblegum accents.' },
  { id: 'chromecore', label: 'Chromecore', description: 'Polished silver utility chrome with cool cyan trims.' },
  { id: 'y2k futurism', label: 'Y2K Futurism', description: 'Dark glossy shell with neon cyan-magenta title lighting.' },
  { id: 'transparent', label: 'Transparent', description: 'Glass-panel widget chrome for overlays that need to stay airy.' },
  { id: 'aqua pop', label: 'Aqua Pop', description: 'Glossy candy-aqua shell with bright dashboard glass energy.' },
  { id: 'mallsoft pearl', label: 'Mallsoft Pearl', description: 'Dreamy retail-kiosk pearl plastic with soft blush bloom.' },
  { id: 'messenger glow', label: 'Messenger Glow', description: 'Buddy-list greens and silver utility plastics with lively presence.' },
  { id: 'limewire plasma', label: 'Limewire Plasma', description: 'Acid green transfer-energy skin with cyber scan movement.' },
  { id: 'cyber y2k', label: 'Cyber Y2K', description: 'Chrome-neon club futurism with magenta cyan voltage.' },
  { id: 'digital futurism', label: 'Digital Futurism', description: 'Sleek concept-device glass and luminous interface metal.' },
  { id: 'ssx rush', label: 'SSX Rush', description: 'Extreme-sports dashboard energy with hot slopes and arcade speed.' },
  { id: 'ps2 drift', label: 'PS2 Drift', description: 'Late-night menu blues and sixth-gen menu-space ambience.' },
  { id: 'xbox blade', label: 'Xbox Blade', description: 'Early-2000s techno utility green with dashboard scan grit.' },
  { id: 'cel street', label: 'Cel Street', description: 'Jet Set street graphics with graphic outlines and painted energy.' },
  { id: 'aero nova', label: 'Aero Nova', description: 'Frutiger Aero turned brighter, wetter, and more kinetic.' },
  { id: 'aero opaline', label: 'Aero Opaline', description: 'Pearlescent glass, aquatic light, and premium Aero softness.' },
  { id: 'dial-up candy', label: 'Dial-Up Candy', description: 'ISP-install-CD gloss, modem LEDs, and bright portal blues.' },
  { id: 'webcore flash', label: 'Webcore Flash', description: 'Button-heavy portal aesthetics with blinkie-banner energy.' },
  { id: 'lan party', label: 'LAN Party', description: 'CRT utility green with late-night file-share atmosphere.' },
]

export const WIDGET_THEME_ANIMATIONS: Array<{
  id: DesktopConfig['widgetTheme']['animation']
  label: string
  description: string
}> = [
  { id: 'steady', label: 'Steady', description: 'Minimal motion, stable and polished.' },
  { id: 'pulse', label: 'Pulse', description: 'Breathing chrome and soft accent surges.' },
  { id: 'shimmer', label: 'Shimmer', description: 'Traveling specular highlights and gloss sweeps.' },
  { id: 'aurora', label: 'Aurora', description: 'Slow morphing light bands and neon drift.' },
  { id: 'broadcast', label: 'Broadcast', description: 'Scan, flicker, and transmission energy.' },
]

export const WIDGET_THEME_ATMOSPHERES: Array<{
  id: DesktopConfig['widgetTheme']['atmosphere']
  label: string
}> = [
  { id: 'clean', label: 'Clean' },
  { id: 'sparkle', label: 'Sparkle' },
  { id: 'scanlines', label: 'Scanlines' },
  { id: 'grid', label: 'Grid' },
  { id: 'nebula', label: 'Nebula' },
]

export const ICON_ANIMATIONS: { id: DesktopConfig['iconAnimation']; label: string }[] = [
  { id: 'none', label: 'Static' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'float', label: 'Float' },
  { id: 'jiggle', label: 'Jiggle' },
  { id: 'drift', label: 'Drift' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'reactive', label: 'Reactive' },
]

const DESKTOP_ICON_SIZES: DesktopConfig['defaultIconSize'][] = ['small', 'normal', 'large']

export function iconSizeToSliderValue(size: DesktopConfig['defaultIconSize']) {
  return DESKTOP_ICON_SIZES.indexOf(size)
}

export function sliderValueToIconSize(value: number): DesktopConfig['defaultIconSize'] {
  return DESKTOP_ICON_SIZES[Math.max(0, Math.min(DESKTOP_ICON_SIZES.length - 1, Math.round(value)))]
}

export function labelizeIconSize(size: DesktopConfig['defaultIconSize']) {
  return size.charAt(0).toUpperCase() + size.slice(1)
}
