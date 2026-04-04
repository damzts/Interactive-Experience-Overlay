import type { CSSProperties } from 'react'
import { DEFAULT_WIDGET_THEME_PRESETS } from '@ieom/shared'
import type { WidgetThemeConfig } from '@ieom/shared'

function buildFontStack(fontFamily: string, fallback: string) {
  return `"${fontFamily.replace(/"/g, '\\"')}", ${fallback}`
}

function opaqueHexColor(input: string, fallback: string) {
  const value = input.trim()
  if (/^#[\da-fA-F]{3,4}$/.test(value)) {
    const expanded = value.slice(1).split('').map((char) => char + char).join('')
    return `#${expanded.slice(0, 6)}`
  }
  if (/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(value)) {
    return `#${value.slice(1, 7)}`
  }
  return fallback
}

export function buildWidgetThemeScopeClassNames(widgetTheme: WidgetThemeConfig) {
  return [
    'desktop-widget-theme-scope',
    `desktop--widget-skin-${widgetTheme.skin.replace(/\s+/g, '-')}`,
    `desktop--widget-animation-${widgetTheme.animation}`,
    `desktop--widget-atmosphere-${widgetTheme.atmosphere}`,
  ].join(' ')
}

export function buildWidgetThemeVars(widgetTheme: WidgetThemeConfig): CSSProperties {
  const preset = DEFAULT_WIDGET_THEME_PRESETS[widgetTheme.skin] ?? DEFAULT_WIDGET_THEME_PRESETS.metalheart
  const accent = opaqueHexColor(widgetTheme.accentColor || preset.accentColor, preset.accentColor)
  const text = opaqueHexColor(widgetTheme.textColor || preset.textColor, preset.textColor)
  const fontFamily = widgetTheme.fontFamily === 'default' ? preset.fontFamily : widgetTheme.fontFamily

  const vars: Record<string, string> = {
    '--widget-font': 'Segoe UI, Arial, sans-serif',
    '--widget-title-font': 'Segoe UI, Arial, sans-serif',
    '--widget-shell-bg': 'linear-gradient(180deg, #d7dce5 0%, #8c95a5 100%)',
    '--widget-shell-highlight': '#f9fbff',
    '--widget-shell-shadow': '#4c5568',
    '--widget-shell-outline': '#151922',
    '--widget-shell-shadow-drop': '5px 6px 18px rgba(0, 0, 0, 0.42)',
    '--widget-title-start': '#5c6472',
    '--widget-title-end': accent,
    '--widget-title-text': text,
    '--widget-title-shadow': '0 1px 0 rgba(0, 0, 0, 0.45)',
    '--widget-title-border': 'rgba(255, 255, 255, 0.18)',
    '--widget-body-bg': 'rgba(236, 240, 247, 0.96)',
    '--widget-body-text': text,
    '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0) 40%)',
    '--widget-body-border': 'rgba(255, 255, 255, 0.2)',
    '--widget-control-bg': 'linear-gradient(180deg, #fdfefe 0%, #cfd6e3 100%)',
    '--widget-control-hover': accent,
    '--widget-control-text': text,
    '--widget-control-border': '#546073',
    '--widget-control-shadow': 'inset 1px 1px 0 rgba(255, 255, 255, 0.75), inset -1px -1px 0 rgba(0, 0, 0, 0.22)',
    '--widget-input-bg': 'rgba(255, 255, 255, 0.92)',
    '--widget-input-text': '#111827',
    '--widget-input-border': '#66758a',
    '--widget-resize-handle': 'linear-gradient(135deg, transparent 0%, transparent 35%, #556173 35%, #556173 55%, #cfd6e3 55%, #cfd6e3 75%, #556173 75%, #556173 100%)',
    '--widget-backdrop-filter': 'none',
    '--widget-motion-scale': String(widgetTheme.motionIntensity),
    '--widget-glow-strength': String(widgetTheme.glowIntensity),
  }

  if (widgetTheme.skin === 'metalheart') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #e8ebf2 0%, #9199a8 38%, #5e6675 100%)',
      '--widget-shell-highlight': '#fcfdff',
      '--widget-shell-shadow': '#5d6776',
      '--widget-shell-outline': '#222834',
      '--widget-title-start': '#481624',
      '--widget-body-bg': 'rgba(30, 34, 43, 0.96)',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 42%)',
      '--widget-body-border': 'rgba(255, 255, 255, 0.08)',
      '--widget-control-bg': 'linear-gradient(180deg, #dce1ec 0%, #8790a2 100%)',
      '--widget-control-text': '#1e2532',
      '--widget-control-border': '#31394a',
      '--widget-input-bg': 'rgba(16, 18, 25, 0.94)',
      '--widget-input-text': '#eef4ff',
      '--widget-input-border': '#5e6677',
    })
  } else if (widgetTheme.skin === 'genx soft club') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, rgba(255, 222, 241, 0.98) 0%, rgba(203, 240, 247, 0.98) 100%)',
      '--widget-shell-highlight': '#fff9fe',
      '--widget-shell-shadow': '#b88aac',
      '--widget-shell-outline': '#875f86',
      '--widget-title-start': '#ffe1f2',
      '--widget-title-text': '#391d3e',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.7)',
      '--widget-body-bg': 'rgba(255, 248, 252, 0.94)',
      '--widget-body-text': '#391d3e',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.18) 38%, rgba(255, 255, 255, 0) 100%)',
      '--widget-body-border': 'rgba(255, 255, 255, 0.42)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #f7d9ed 100%)',
      '--widget-control-text': '#4e2450',
      '--widget-control-border': '#a7709d',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.92)',
      '--widget-input-text': '#38173a',
      '--widget-input-border': '#cc9dbf',
    })
  } else if (widgetTheme.skin === 'chromecore') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #fdfefe 0%, #c6d1dd 28%, #909daa 54%, #e5ebf3 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#768392',
      '--widget-shell-outline': '#253140',
      '--widget-title-start': '#d9e4ef',
      '--widget-title-text': '#132231',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.62)',
      '--widget-body-bg': 'rgba(229, 236, 244, 0.96)',
      '--widget-body-text': '#132231',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.52) 0%, rgba(255, 255, 255, 0.12) 36%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #fbfdff 0%, #cfd8e4 100%)',
      '--widget-control-text': '#122130',
      '--widget-control-border': '#5c6b7c',
      '--widget-input-bg': 'rgba(247, 250, 255, 0.96)',
      '--widget-input-text': '#132231',
      '--widget-input-border': '#7f91a5',
    })
  } else if (widgetTheme.skin === 'y2k futurism') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #1d2331 0%, #0b0f18 100%)',
      '--widget-shell-highlight': '#5f728c',
      '--widget-shell-shadow': '#060810',
      '--widget-shell-outline': '#8bdfff',
      '--widget-shell-shadow-drop': '0 10px 30px rgba(0, 0, 0, 0.56), 0 0 18px rgba(44, 247, 255, 0.22)',
      '--widget-title-start': '#071723',
      '--widget-title-text': '#ebfbff',
      '--widget-title-shadow': '0 0 12px rgba(44, 247, 255, 0.35)',
      '--widget-title-border': 'rgba(139, 223, 255, 0.26)',
      '--widget-body-bg': 'linear-gradient(180deg, rgba(11, 18, 30, 0.96) 0%, rgba(16, 30, 53, 0.93) 100%)',
      '--widget-body-text': '#ebfbff',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(44, 247, 255, 0.08) 0%, rgba(255, 255, 255, 0) 32%)',
      '--widget-body-border': 'rgba(139, 223, 255, 0.16)',
      '--widget-control-bg': 'linear-gradient(180deg, #18263f 0%, #0d1523 100%)',
      '--widget-control-text': '#f3fbff',
      '--widget-control-border': '#52a9c5',
      '--widget-input-bg': 'rgba(4, 10, 19, 0.94)',
      '--widget-input-text': '#ebfbff',
      '--widget-input-border': '#45a7ca',
    })
  } else if (widgetTheme.skin === 'transparent') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%)',
      '--widget-shell-highlight': 'rgba(255, 255, 255, 0.45)',
      '--widget-shell-shadow': 'rgba(110, 151, 177, 0.45)',
      '--widget-shell-outline': 'rgba(255, 255, 255, 0.2)',
      '--widget-shell-shadow-drop': '0 12px 28px rgba(0, 0, 0, 0.38)',
      '--widget-title-start': 'rgba(255, 255, 255, 0.3)',
      '--widget-title-text': '#effcff',
      '--widget-title-shadow': '0 1px 10px rgba(0, 0, 0, 0.35)',
      '--widget-title-border': 'rgba(255, 255, 255, 0.18)',
      '--widget-body-bg': 'rgba(10, 18, 32, 0.34)',
      '--widget-body-text': '#effcff',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 34%)',
      '--widget-body-border': 'rgba(255, 255, 255, 0.14)',
      '--widget-control-bg': 'linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.08) 100%)',
      '--widget-control-text': '#effcff',
      '--widget-control-border': 'rgba(255, 255, 255, 0.18)',
      '--widget-input-bg': 'rgba(6, 12, 24, 0.42)',
      '--widget-input-text': '#effcff',
      '--widget-input-border': 'rgba(255, 255, 255, 0.18)',
      '--widget-backdrop-filter': 'blur(18px) saturate(130%)',
    })
  } else if (widgetTheme.skin === 'aqua pop') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #f7feff 0%, #9eeaff 38%, #59bede 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#4790ae',
      '--widget-shell-outline': '#0e5571',
      '--widget-shell-shadow-drop': '0 12px 26px rgba(41, 117, 149, 0.28)',
      '--widget-title-start': '#d9fbff',
      '--widget-title-text': '#08374c',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.78)',
      '--widget-body-bg': 'rgba(232, 251, 255, 0.94)',
      '--widget-body-text': '#08374c',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.08) 42%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #c8f5ff 100%)',
      '--widget-control-text': '#0c4b63',
      '--widget-control-border': '#5ca8c2',
      '--widget-input-bg': 'rgba(253, 255, 255, 0.96)',
      '--widget-input-text': '#0d4154',
      '--widget-input-border': '#80c8dd',
    })
  } else if (widgetTheme.skin === 'mallsoft pearl') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #fff7fd 0%, #ffd9f2 42%, #d7c8ff 100%)',
      '--widget-shell-highlight': '#fffdfd',
      '--widget-shell-shadow': '#bda4d2',
      '--widget-shell-outline': '#8f6ea3',
      '--widget-shell-shadow-drop': '0 14px 28px rgba(154, 118, 179, 0.22)',
      '--widget-title-start': '#fff4fd',
      '--widget-title-text': '#5a2b58',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.8)',
      '--widget-body-bg': 'rgba(255, 248, 252, 0.94)',
      '--widget-body-text': '#5a2b58',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 241, 250, 0.16) 42%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #fffefe 0%, #ffe3f4 100%)',
      '--widget-control-text': '#6d3970',
      '--widget-control-border': '#c89ac2',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.92)',
      '--widget-input-text': '#5a2b58',
      '--widget-input-border': '#ddb5d5',
    })
  } else if (widgetTheme.skin === 'messenger glow') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #f4fff8 0%, #b7ffd1 38%, #87c5a0 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#7aaf91',
      '--widget-shell-outline': '#2f6652',
      '--widget-shell-shadow-drop': '0 10px 24px rgba(72, 124, 96, 0.24)',
      '--widget-title-start': '#eefff4',
      '--widget-title-text': '#16352a',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.82)',
      '--widget-body-bg': 'rgba(242, 255, 246, 0.94)',
      '--widget-body-text': '#16352a',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.52) 0%, rgba(255, 255, 255, 0.08) 44%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #d9ffea 100%)',
      '--widget-control-text': '#1c4a37',
      '--widget-control-border': '#7eb592',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.94)',
      '--widget-input-text': '#17382b',
      '--widget-input-border': '#93cfaa',
    })
  } else if (widgetTheme.skin === 'limewire plasma') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #20371a 0%, #0d160b 100%)',
      '--widget-shell-highlight': '#70ff65',
      '--widget-shell-shadow': '#081006',
      '--widget-shell-outline': '#a8ff8b',
      '--widget-shell-shadow-drop': '0 10px 30px rgba(0, 0, 0, 0.58), 0 0 24px rgba(122, 255, 84, 0.2)',
      '--widget-title-start': '#0b1409',
      '--widget-title-text': '#e8ffe1',
      '--widget-title-shadow': '0 0 12px rgba(122, 255, 84, 0.24)',
      '--widget-title-border': 'rgba(122, 255, 84, 0.28)',
      '--widget-body-bg': 'linear-gradient(180deg, rgba(10, 21, 9, 0.96) 0%, rgba(19, 45, 14, 0.94) 100%)',
      '--widget-body-text': '#e8ffe1',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(122, 255, 84, 0.08) 0%, rgba(255, 255, 255, 0) 28%)',
      '--widget-body-border': 'rgba(122, 255, 84, 0.12)',
      '--widget-control-bg': 'linear-gradient(180deg, #20331a 0%, #0a1308 100%)',
      '--widget-control-text': '#e8ffe1',
      '--widget-control-border': '#72db5d',
      '--widget-input-bg': 'rgba(5, 12, 4, 0.94)',
      '--widget-input-text': '#e8ffe1',
      '--widget-input-border': '#62c552',
    })
  } else if (widgetTheme.skin === 'cyber y2k') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #28163d 0%, #0c0f1b 100%)',
      '--widget-shell-highlight': '#ffb9ff',
      '--widget-shell-shadow': '#070915',
      '--widget-shell-outline': '#62edff',
      '--widget-shell-shadow-drop': '0 12px 34px rgba(0, 0, 0, 0.58), 0 0 24px rgba(255, 109, 255, 0.24)',
      '--widget-title-start': '#150c24',
      '--widget-title-text': '#f4fbff',
      '--widget-title-shadow': '0 0 14px rgba(255, 109, 255, 0.34)',
      '--widget-title-border': 'rgba(98, 237, 255, 0.24)',
      '--widget-body-bg': 'linear-gradient(180deg, rgba(16, 11, 28, 0.96) 0%, rgba(22, 28, 54, 0.94) 100%)',
      '--widget-body-text': '#f4fbff',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 109, 255, 0.09) 0%, rgba(255, 255, 255, 0) 30%)',
      '--widget-body-border': 'rgba(98, 237, 255, 0.14)',
      '--widget-control-bg': 'linear-gradient(180deg, #2a1d42 0%, #101726 100%)',
      '--widget-control-text': '#f4fbff',
      '--widget-control-border': '#62edff',
      '--widget-input-bg': 'rgba(8, 10, 19, 0.94)',
      '--widget-input-text': '#f4fbff',
      '--widget-input-border': '#4ca9c8',
    })
  } else if (widgetTheme.skin === 'digital futurism') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #f8fdff 0%, #b7d5e8 30%, #6a8ea7 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#5c758a',
      '--widget-shell-outline': '#17384f',
      '--widget-shell-shadow-drop': '0 14px 28px rgba(28, 68, 95, 0.24)',
      '--widget-title-start': '#edf9ff',
      '--widget-title-text': '#12354e',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.82)',
      '--widget-body-bg': 'rgba(236, 247, 255, 0.95)',
      '--widget-body-text': '#12354e',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #d7ebf8 100%)',
      '--widget-control-text': '#13384c',
      '--widget-control-border': '#7aa2bc',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.96)',
      '--widget-input-text': '#13384c',
      '--widget-input-border': '#8fb3c9',
    })
  } else if (widgetTheme.skin === 'ssx rush') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #fff5ed 0%, #ffb56c 36%, #ef4b2d 100%)',
      '--widget-shell-highlight': '#fff9f2',
      '--widget-shell-shadow': '#b84f39',
      '--widget-shell-outline': '#5a2332',
      '--widget-shell-shadow-drop': '0 16px 30px rgba(127, 45, 28, 0.26)',
      '--widget-title-start': '#fff3df',
      '--widget-title-text': '#4b1322',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.7)',
      '--widget-body-bg': 'rgba(255, 244, 233, 0.95)',
      '--widget-body-text': '#4b1322',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.44) 0%, rgba(255, 214, 175, 0.12) 42%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #fff6eb 0%, #ffc48c 100%)',
      '--widget-control-text': '#5b1f25',
      '--widget-control-border': '#d56b45',
      '--widget-input-bg': 'rgba(255, 251, 246, 0.95)',
      '--widget-input-text': '#4b1322',
      '--widget-input-border': '#f39a65',
    })
  } else if (widgetTheme.skin === 'ps2 drift') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #23396f 0%, #11162b 100%)',
      '--widget-shell-highlight': '#b3ceff',
      '--widget-shell-shadow': '#090c17',
      '--widget-shell-outline': '#7cb3ff',
      '--widget-shell-shadow-drop': '0 12px 30px rgba(0, 0, 0, 0.54), 0 0 20px rgba(107, 164, 255, 0.18)',
      '--widget-title-start': '#131b39',
      '--widget-title-text': '#edf3ff',
      '--widget-title-shadow': '0 0 10px rgba(107, 164, 255, 0.3)',
      '--widget-title-border': 'rgba(124, 179, 255, 0.22)',
      '--widget-body-bg': 'linear-gradient(180deg, rgba(11, 17, 34, 0.96) 0%, rgba(18, 29, 58, 0.93) 100%)',
      '--widget-body-text': '#edf3ff',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(107, 164, 255, 0.08) 0%, rgba(255, 255, 255, 0) 28%)',
      '--widget-control-bg': 'linear-gradient(180deg, #20346a 0%, #0d1322 100%)',
      '--widget-control-text': '#edf3ff',
      '--widget-control-border': '#5f8dcf',
      '--widget-input-bg': 'rgba(7, 11, 22, 0.94)',
      '--widget-input-text': '#edf3ff',
      '--widget-input-border': '#4f73aa',
    })
  } else if (widgetTheme.skin === 'xbox blade') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #24331f 0%, #0b1209 100%)',
      '--widget-shell-highlight': '#b9ff9f',
      '--widget-shell-shadow': '#060a05',
      '--widget-shell-outline': '#79ff5a',
      '--widget-shell-shadow-drop': '0 12px 34px rgba(0, 0, 0, 0.56), 0 0 22px rgba(121, 255, 90, 0.18)',
      '--widget-title-start': '#0d140b',
      '--widget-title-text': '#efffe7',
      '--widget-title-shadow': '0 0 12px rgba(121, 255, 90, 0.22)',
      '--widget-title-border': 'rgba(121, 255, 90, 0.24)',
      '--widget-body-bg': 'linear-gradient(180deg, rgba(9, 15, 8, 0.96) 0%, rgba(15, 31, 12, 0.94) 100%)',
      '--widget-body-text': '#efffe7',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(121, 255, 90, 0.08) 0%, rgba(255, 255, 255, 0) 26%)',
      '--widget-control-bg': 'linear-gradient(180deg, #203019 0%, #091107 100%)',
      '--widget-control-text': '#efffe7',
      '--widget-control-border': '#66cf4d',
      '--widget-input-bg': 'rgba(5, 10, 4, 0.94)',
      '--widget-input-text': '#efffe7',
      '--widget-input-border': '#4cae3f',
    })
  } else if (widgetTheme.skin === 'cel street') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #fff0a5 0%, #ff8f4b 42%, #ff4f70 100%)',
      '--widget-shell-highlight': '#fffbe3',
      '--widget-shell-shadow': '#d4503c',
      '--widget-shell-outline': '#121728',
      '--widget-shell-shadow-drop': '8px 10px 0 rgba(18, 23, 40, 0.42)',
      '--widget-title-start': '#fff3b6',
      '--widget-title-text': '#14192a',
      '--widget-title-shadow': 'none',
      '--widget-title-border': 'rgba(20, 25, 42, 0.38)',
      '--widget-body-bg': 'rgba(255, 246, 224, 0.96)',
      '--widget-body-text': '#14192a',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #fff8d8 0%, #ffd66f 100%)',
      '--widget-control-text': '#14192a',
      '--widget-control-border': '#14192a',
      '--widget-control-shadow': 'inset 0 0 0 2px rgba(20, 25, 42, 0.1)',
      '--widget-input-bg': 'rgba(255, 251, 237, 0.96)',
      '--widget-input-text': '#14192a',
      '--widget-input-border': '#14192a',
    })
  } else if (widgetTheme.skin === 'aero nova') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, rgba(243, 252, 255, 0.98) 0%, rgba(151, 227, 255, 0.94) 40%, rgba(88, 171, 217, 0.98) 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#5c97be',
      '--widget-shell-outline': '#196182',
      '--widget-shell-shadow-drop': '0 16px 30px rgba(59, 142, 185, 0.24)',
      '--widget-title-start': '#ffffff',
      '--widget-title-text': '#103b58',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.84)',
      '--widget-body-bg': 'rgba(239, 251, 255, 0.95)',
      '--widget-body-text': '#103b58',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.64) 0%, rgba(193, 239, 255, 0.12) 40%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #d6f4ff 100%)',
      '--widget-control-text': '#12435e',
      '--widget-control-border': '#69b8d8',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.96)',
      '--widget-input-text': '#12435e',
      '--widget-input-border': '#8ac9e4',
      '--widget-backdrop-filter': 'blur(8px) saturate(120%)',
    })
  } else if (widgetTheme.skin === 'aero opaline') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, rgba(250, 255, 255, 0.98) 0%, rgba(210, 255, 247, 0.94) 40%, rgba(131, 216, 222, 0.98) 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#73aeb3',
      '--widget-shell-outline': '#2a6f80',
      '--widget-shell-shadow-drop': '0 14px 30px rgba(76, 154, 161, 0.22)',
      '--widget-title-start': '#fdffff',
      '--widget-title-text': '#1a4960',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.88)',
      '--widget-body-bg': 'rgba(244, 255, 253, 0.95)',
      '--widget-body-text': '#1a4960',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.66) 0%, rgba(210, 255, 247, 0.1) 40%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #dffdf8 100%)',
      '--widget-control-text': '#1a4960',
      '--widget-control-border': '#88c9ca',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.96)',
      '--widget-input-text': '#1a4960',
      '--widget-input-border': '#9ad6d1',
      '--widget-backdrop-filter': 'blur(10px) saturate(124%)',
    })
  } else if (widgetTheme.skin === 'dial-up candy') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #f8fbff 0%, #bfe8ff 34%, #82c2ff 100%)',
      '--widget-shell-highlight': '#ffffff',
      '--widget-shell-shadow': '#6e9fcb',
      '--widget-shell-outline': '#35618e',
      '--widget-shell-shadow-drop': '0 14px 28px rgba(56, 105, 151, 0.24)',
      '--widget-title-start': '#f3fbff',
      '--widget-title-text': '#20344d',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.84)',
      '--widget-body-bg': 'rgba(241, 249, 255, 0.95)',
      '--widget-body-text': '#20344d',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(171, 227, 255, 0.16) 40%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #ffffff 0%, #d7f1ff 100%)',
      '--widget-control-text': '#21415e',
      '--widget-control-border': '#75acd4',
      '--widget-input-bg': 'rgba(255, 255, 255, 0.96)',
      '--widget-input-text': '#21415e',
      '--widget-input-border': '#97c7e3',
    })
  } else if (widgetTheme.skin === 'webcore flash') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #fff9c8 0%, #ffb54a 40%, #ff5988 100%)',
      '--widget-shell-highlight': '#fffef4',
      '--widget-shell-shadow': '#cb5f50',
      '--widget-shell-outline': '#34204b',
      '--widget-shell-shadow-drop': '0 16px 28px rgba(134, 52, 73, 0.24)',
      '--widget-title-start': '#fff8da',
      '--widget-title-text': '#281b3d',
      '--widget-title-shadow': '0 1px 0 rgba(255, 255, 255, 0.72)',
      '--widget-body-bg': 'rgba(255, 248, 225, 0.95)',
      '--widget-body-text': '#281b3d',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(255, 255, 255, 0.44) 0%, rgba(255, 205, 123, 0.12) 42%, rgba(255, 255, 255, 0) 100%)',
      '--widget-control-bg': 'linear-gradient(180deg, #fff9df 0%, #ffd56b 100%)',
      '--widget-control-text': '#2d2140',
      '--widget-control-border': '#8a437d',
      '--widget-input-bg': 'rgba(255, 252, 242, 0.96)',
      '--widget-input-text': '#2d2140',
      '--widget-input-border': '#d28b69',
    })
  } else if (widgetTheme.skin === 'lan party') {
    Object.assign(vars, {
      '--widget-shell-bg': 'linear-gradient(180deg, #17352d 0%, #09130f 100%)',
      '--widget-shell-highlight': '#8dffd7',
      '--widget-shell-shadow': '#050907',
      '--widget-shell-outline': '#67ffcc',
      '--widget-shell-shadow-drop': '0 12px 34px rgba(0, 0, 0, 0.58), 0 0 24px rgba(103, 255, 204, 0.18)',
      '--widget-title-start': '#0c1713',
      '--widget-title-text': '#e7fff7',
      '--widget-title-shadow': '0 0 12px rgba(103, 255, 204, 0.2)',
      '--widget-title-border': 'rgba(103, 255, 204, 0.22)',
      '--widget-body-bg': 'linear-gradient(180deg, rgba(8, 15, 13, 0.96) 0%, rgba(11, 30, 25, 0.94) 100%)',
      '--widget-body-text': '#e7fff7',
      '--widget-body-overlay': 'linear-gradient(180deg, rgba(103, 255, 204, 0.08) 0%, rgba(255, 255, 255, 0) 28%)',
      '--widget-body-border': 'rgba(103, 255, 204, 0.12)',
      '--widget-control-bg': 'linear-gradient(180deg, #183026 0%, #09130f 100%)',
      '--widget-control-text': '#e7fff7',
      '--widget-control-border': '#58d2a9',
      '--widget-input-bg': 'rgba(4, 10, 8, 0.94)',
      '--widget-input-text': '#e7fff7',
      '--widget-input-border': '#49b491',
    })
  }

  vars['--widget-title-end'] = accent
  vars['--widget-control-hover'] = accent
  vars['--widget-title-text'] = text
  vars['--widget-body-text'] = text
  vars['--widget-font'] = buildFontStack(fontFamily, 'Segoe UI, Arial, sans-serif')
  vars['--widget-title-font'] = buildFontStack(fontFamily, 'Segoe UI, Arial, sans-serif')
  vars['--widget-motion-scale'] = String(widgetTheme.motionIntensity)
  vars['--widget-glow-strength'] = String(widgetTheme.glowIntensity)

  return vars as CSSProperties
}