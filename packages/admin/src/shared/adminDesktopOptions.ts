import {
  DEFAULT_WIDGET_THEME_PRESETS,
  DESKTOP_ICON_ANIMATION_IDS,
  DESKTOP_ICON_ARRANGEMENT_IDS,
  DESKTOP_THEME_IDS,
  WIDGET_SHAPE_IDS,
  WIDGET_THEME_ANIMATION_IDS,
  WIDGET_THEME_ATMOSPHERE_IDS,
} from '@ieomlabs/shared'
import type { DesktopConfig, DesktopIconArrangement, DesktopTheme, WidgetShape, WidgetThemeConfig } from '@ieomlabs/shared'

/** Builds the `{ id, label, description }[]` shape every picker below uses,
 *  from an ordered id list plus a `Record` of copy keyed by the same union
 *  the shared domain type defines. Because the copy map is a `Record`, not an
 *  array, TypeScript refuses to compile if a new id (new desktop theme, widget
 *  skin, shape, …) lands in shared without matching copy here — the old
 *  hand-written arrays let new ids silently go missing from admin pickers. */
function describeOptions<Id extends string>(ids: readonly Id[], copy: Record<Id, { label: string; description: string }>) {
  return ids.map((id) => ({ id, ...copy[id] }))
}

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

const DESKTOP_THEME_COPY: Record<DesktopTheme, { label: string; description: string }> = {
  win98: { label: 'Win98', description: 'Classic desktop chrome with utilitarian bevels, neutral panels, and retro shell clarity.' },
  'frutiger aero': { label: 'Frutiger Aero', description: 'Glossy glass surfaces, aquatic light, and soft optimistic UI polish.' },
  'y2k candy': { label: 'Y2K Candy', description: 'Bright plastic color, pop-tech gradients, and playful portal-era gloss.' },
  'midnight chrome': { label: 'Midnight Chrome', description: 'Dark metallic shell styling with cool reflections and broadcast-night weight.' },
  'sunset boulevard': { label: 'Sunset Boulevard', description: 'Warm nightlife tones, hot highlights, and showtime desktop energy.' },
  'coastal glass': { label: 'Coastal Glass', description: 'Airy glass chrome with sea-light softness and open, bright framing.' },
  'amber terminal': { label: 'Amber Terminal', description: 'CRT utility warmth, terminal glow, and focused monochrome control-room mood.' },
  diablo: { label: 'Diablo', description: 'Dark fantasy dungeon tones — bone, blood red, and aged gold trim.' },
  matrix: { label: 'Matrix', description: 'Green phosphor terminal glow on near-black, digital-rain mood.' },
  cyberpunk: { label: 'Cyberpunk', description: 'Neon magenta and cyan on near-black, high-contrast night-city energy.' },
  runescape: { label: 'RuneScape', description: 'Classic MMORPG parchment brown, steel blue, and gold-leaf accents.' },
  'aero saint': { label: 'Aero Saint', description: 'Vista glass and a magical-girl transformation glow — wet, lit from inside, one beat from a halo bloom.' },
  'chrome requiem': { label: 'Chrome Requiem', description: 'Winamp-metal chrome bolted to an MMO loot ticker — forged bevels, engraved title bars.' },
  'trick city': { label: 'Trick City', description: 'SSX podium cockiness sprayed over Jet Set Radio tags — hot orange and graffiti cyan.' },
  'save point': { label: 'Save Point', description: 'JRPG menu-box blues and gold, an ATB gauge idling in the corner of the desktop.' },
  'dial tone dream': { label: 'Dial Tone Dream', description: 'Y2K gel-button optimism — buddy lists, pastel plastic, sincere instead of ironic.' },
  'signal ghost': { label: 'Signal Ghost', description: 'A worn VHS tape of a Saturday-morning anime block, still playing — chromatic-aberration chrome.' },
  'podium chrome': { label: 'Podium Chrome', description: 'Vista glass poured over an SSX medal ceremony — gold light and confetti chrome.' },
  custom: { label: 'Custom', description: 'Use your current font and color overrides as a hand-tuned desktop shell profile.' },
}

export const DESKTOP_THEMES: Array<{ id: DesktopTheme; label: string; description: string }> =
  describeOptions([...DESKTOP_THEME_IDS, 'custom'], DESKTOP_THEME_COPY)

const WIDGET_SKIN_COPY: Record<WidgetThemeConfig['skin'], { label: string; description: string }> = {
  metalheart: { label: 'Metalheart', description: 'Brushed alloy shell with hot-pink hardware and arcade steel highlights.' },
  'genx soft club': { label: 'GenX Soft Club', description: 'Pastel nightclub plastic with glossy mint and bubblegum accents.' },
  chromecore: { label: 'Chromecore', description: 'Polished silver utility chrome with cool cyan trims.' },
  'y2k futurism': { label: 'Y2K Futurism', description: 'Dark glossy shell with neon cyan-magenta title lighting.' },
  transparent: { label: 'Transparent', description: 'Glass-panel widget chrome for overlays that need to stay airy.' },
  'aqua pop': { label: 'Aqua Pop', description: 'Glossy candy-aqua shell with bright dashboard glass energy.' },
  'mallsoft pearl': { label: 'Mallsoft Pearl', description: 'Dreamy retail-kiosk pearl plastic with soft blush bloom.' },
  'messenger glow': { label: 'Messenger Glow', description: 'Buddy-list greens and silver utility plastics with lively presence.' },
  'limewire plasma': { label: 'Limewire Plasma', description: 'Acid green transfer-energy skin with cyber scan movement.' },
  'cyber y2k': { label: 'Cyber Y2K', description: 'Chrome-neon club futurism with magenta cyan voltage.' },
  'digital futurism': { label: 'Digital Futurism', description: 'Sleek concept-device glass and luminous interface metal.' },
  'ssx rush': { label: 'SSX Rush', description: 'Extreme-sports dashboard energy with hot slopes and arcade speed.' },
  'ps2 drift': { label: 'PS2 Drift', description: 'Late-night menu blues and sixth-gen menu-space ambience.' },
  'xbox blade': { label: 'Xbox Blade', description: 'Early-2000s techno utility green with dashboard scan grit.' },
  'cel street': { label: 'Cel Street', description: 'Jet Set street graphics with graphic outlines and painted energy.' },
  'aero nova': { label: 'Aero Nova', description: 'Frutiger Aero turned brighter, wetter, and more kinetic.' },
  'aero opaline': { label: 'Aero Opaline', description: 'Pearlescent glass, aquatic light, and premium Aero softness.' },
  'dial-up candy': { label: 'Dial-Up Candy', description: 'ISP-install-CD gloss, modem LEDs, and bright portal blues.' },
  'webcore flash': { label: 'Webcore Flash', description: 'Button-heavy portal aesthetics with blinkie-banner energy.' },
  'lan party': { label: 'LAN Party', description: 'CRT utility green with late-night file-share atmosphere.' },
  'aero saint': { label: 'Aero Saint', description: 'Vista glass and golden-age anime power-up bloom — sparkle atmosphere, aurora sheen.' },
  'chrome requiem': { label: 'Chrome Requiem', description: 'Metalheart chrome and Ragnarok Online loot lineage — forged bevel, scanline grit.' },
  'trick city': { label: 'Trick City', description: 'SSX trick-combo swagger meets Jet Set Radio graffiti — kinetic wing silhouette.' },
  'save point': { label: 'Save Point', description: 'JRPG menu-box chrome with a gem-notch tab — nebula atmosphere, steady motion.' },
  'dial tone dream': { label: 'Dial Tone Dream', description: 'Y2K gel-button plastic, sincere buddy-list optimism.' },
  'signal ghost': { label: 'Signal Ghost', description: 'VHS chromatic-aberration chrome — Toonami-bumper broadcast energy.' },
  'podium chrome': { label: 'Podium Chrome', description: 'Vista/Frutiger gloss over an SSX medal-ceremony podium — gold-glass rim.' },
}

export const WIDGET_SKINS: Array<{ id: WidgetThemeConfig['skin']; label: string; description: string }> =
  describeOptions(Object.keys(DEFAULT_WIDGET_THEME_PRESETS) as WidgetThemeConfig['skin'][], WIDGET_SKIN_COPY)

const WIDGET_SHAPE_COPY: Record<WidgetShape, { label: string; description: string }> = {
  rect: { label: 'Rectangle', description: 'Classic rectangular window chrome. The Radius slider still rounds corners.' },
  bevel: { label: 'Bevel', description: 'Winamp-style octagon with all four corners cut at 45°.' },
  'notch-hud': { label: 'Notch HUD', description: 'Asymmetric Y2K silhouette — long diagonal top-right, mirrored bottom-left.' },
  blob: { label: 'Blob', description: 'Organic wobbly plastic with uneven rounded corners.' },
  tv: { label: 'CRT', description: 'Television bulge — soft top corners, heavy rounded bottom.' },
  sticker: { label: 'Sticker', description: 'Burst sticker with sawtooth teeth around the whole edge.' },
  metalheart: { label: 'Metalheart', description: 'Asymmetric hardware hull with a carved fin recess and curved keel — Winamp MMD3 lineage.' },
  wing: { label: 'Wing', description: 'Blade swoosh — the top edge sweeps down into the right side.' },
  wave: { label: 'Wave', description: 'Banner with a scalloped curtain hem along the bottom edge.' },
  shard: { label: 'Shard', description: 'Crystalline fragment with jagged asymmetric facets on every edge.' },
  pod: { label: 'Pod', description: 'Soft capsule pod — heavier organic rounding than Blob, egg-bottomed.' },
  codex: { label: 'Codex', description: 'JRPG dialogue-box tab — small corner cuts plus a triangular pointer notch in the top edge.' },
  tag: { label: 'Tag', description: 'Spray-tag silhouette with a torn drip edge along the bottom — Jet Set Radio lineage.' },
}

export const WIDGET_SHAPES: Array<{ id: WidgetShape; label: string; description: string }> =
  describeOptions(WIDGET_SHAPE_IDS, WIDGET_SHAPE_COPY)

const WIDGET_THEME_ANIMATION_COPY: Record<WidgetThemeConfig['animation'], { label: string; description: string }> = {
  steady: { label: 'Steady', description: 'Minimal motion, stable and polished.' },
  pulse: { label: 'Pulse', description: 'Breathing chrome and soft accent surges.' },
  shimmer: { label: 'Shimmer', description: 'Traveling specular highlights and gloss sweeps.' },
  aurora: { label: 'Aurora', description: 'Slow morphing light bands and neon drift.' },
  broadcast: { label: 'Broadcast', description: 'Scan, flicker, and transmission energy.' },
}

export const WIDGET_THEME_ANIMATIONS: Array<{ id: WidgetThemeConfig['animation']; label: string; description: string }> =
  describeOptions(WIDGET_THEME_ANIMATION_IDS, WIDGET_THEME_ANIMATION_COPY)

const WIDGET_THEME_ATMOSPHERE_COPY: Record<WidgetThemeConfig['atmosphere'], { label: string; description: string }> = {
  clean: { label: 'Clean', description: 'No texture layer. Pure chrome, nothing added.' },
  sparkle: { label: 'Sparkle', description: 'Floating particles that drift and fade across the shell.' },
  scanlines: { label: 'Scanlines', description: 'Horizontal CRT lines overlaid on the window body.' },
  grid: { label: 'Grid', description: 'Fine dot or line grid pressed into the background.' },
  nebula: { label: 'Nebula', description: 'Soft color cloud that blooms behind the widget content.' },
}

export const WIDGET_THEME_ATMOSPHERES: Array<{ id: WidgetThemeConfig['atmosphere']; label: string; description: string }> =
  describeOptions(WIDGET_THEME_ATMOSPHERE_IDS, WIDGET_THEME_ATMOSPHERE_COPY)

const ICON_ANIMATION_COPY: Record<DesktopConfig['iconAnimation'], { label: string; description: string }> = {
  none: { label: 'Static', description: 'No ambient motion. Icons sit still at all times.' },
  pulse: { label: 'Pulse', description: 'Icons breathe with a slow scale and glow cycle.' },
  float: { label: 'Float', description: 'Gentle vertical drift, like objects suspended in liquid.' },
  jiggle: { label: 'Jiggle', description: 'Subtle side-to-side wobble with personality.' },
  drift: { label: 'Drift', description: 'Slow horizontal wander across a small range.' },
  orbit: { label: 'Orbit', description: 'Circular idle motion around the icon center.' },
  breathe: { label: 'Breathe', description: 'Opacity cycles in and out on a long slow curve.' },
  reactive: { label: 'Reactive', description: 'Motion responds to audio signal or activity level.' },
}

export const ICON_ANIMATIONS: Array<{ id: DesktopConfig['iconAnimation']; label: string; description: string }> =
  describeOptions(DESKTOP_ICON_ANIMATION_IDS, ICON_ANIMATION_COPY)

const ICON_ARRANGEMENT_COPY: Record<DesktopIconArrangement, { label: string; description: string }> = {
  grid: { label: 'Grid', description: 'Static column layout. Icons stay where placed.' },
  wave: { label: 'Wave', description: 'Icons ride a sine wave sweeping across the screen.' },
  ripple: { label: 'Ripple', description: 'Icons expand and contract in a ring from center.' },
  spiral: { label: 'Spiral', description: 'Icons orbit in a rotating Archimedean spiral.' },
  scatter: { label: 'Scatter', description: 'Each icon traces its own independent Lissajous path.' },
  orbit: { label: 'Orbit', description: 'Icons orbit the screen center in concentric rings.' },
}

export const ICON_ARRANGEMENTS: Array<{ id: DesktopIconArrangement; label: string; description: string }> =
  describeOptions(DESKTOP_ICON_ARRANGEMENT_IDS, ICON_ARRANGEMENT_COPY)

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
