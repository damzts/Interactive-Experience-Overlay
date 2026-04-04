import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { socket } from '../socket/client'
import { DEFAULT_CONFIG, DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS, DEFAULT_WIDGET_THEME_PRESETS, STATE, getWidgetComponent, withDesktopConfigDefaults } from '@ieom/shared'
import type { AmbianceSimulationPayload, Application, DesktopIconDragPayload, DesktopRuntimeStatePayload, DesktopStartMenuRoot, DesktopStartMenuSimulationPhasePayload, DesktopStartMenuStatePayload, DesktopTheme, OverlayStyle, WidgetComponentType, WidgetThemeConfig } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { AppIcon } from './AppIcon'
import { Taskbar } from './Taskbar'
import { ScreenSaver } from './ScreenSaver'
import { MusicWidget } from './MusicWidget'
import { ArchiveWidget } from './ArchiveWidget'
import { ChatWidget } from './ChatWidget'
import { StickyNotesWidget } from './StickyNotesWidget'
import { GalleryWidget } from './GalleryWidget'
import { CameraWidget } from './CameraWidget'
import { SourceWidget } from './SourceWidget'
import { SpectrumAnalyzerWidget } from './SpectrumAnalyzerWidget'
import { EqualizerRackWidget } from './EqualizerRackWidget'
import { WaveScopeWidget } from './WaveScopeWidget'
import { PlaylistDeckWidget } from './PlaylistDeckWidget'
import { NetMeterWidget } from './NetMeterWidget'
import { MediaDeckWidget } from './MediaDeckWidget'
import { CDRipperWidget } from './CDRipperWidget'
import { SignalLabWidget } from './SignalLabWidget'
import { BroadcastSchedulerWidget } from './BroadcastSchedulerWidget'
import { WeatherConsoleWidget } from './WeatherConsoleWidget'
import { ClockTowerWidget } from './ClockTowerWidget'
import { NewswireDeskWidget } from './NewswireDeskWidget'
import { CityNavigatorWidget } from './CityNavigatorWidget'
import { LCDDolphinsWidget } from './LCDDolphinsWidget'
import { DesktopNotifications } from './DesktopNotifications'
import { DesktopWindow } from './DesktopWindow'
import { AppGlyph } from './AppGlyph'
import { patchApplicationConfig, patchDesktopConfig } from './configPersistence'
import { CursorOverlayProvider } from './CursorOverlay'
import { CursorSimExample } from './CursorSimExample'
import { buildOpenWidgetMenuTimeline, closeWidgetByWindowButton, interactWithWidgetByRecipe, runWidgetCursorSimulation, simulateWidgetWindowDrag, simulateWidgetWindowResize } from './cursorSimUtils';
import { getWidgetSimulationRecipe, pickWidgetInteractionStep } from './widgetSimulationRegistry';
import React from 'react';

interface DesktopWidgetProps {
  appId?: string
  defaultCameraLabel?: string
  defaultMirror?: boolean
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

/** Maps widget app IDs to their component. Add new widgets here. */
const WIDGET_COMPONENTS: Partial<Record<WidgetComponentType, React.ComponentType<DesktopWidgetProps>>> = {
  music: MusicWidget,
  archive: ArchiveWidget,
  chat: ChatWidget,
  'sticky-notes': StickyNotesWidget,
  gallery: GalleryWidget,
  camera: CameraWidget,
  source: SourceWidget,
  'spectrum-analyzer': SpectrumAnalyzerWidget,
  'equalizer-rack': EqualizerRackWidget,
  'wave-scope': WaveScopeWidget,
  'playlist-deck': PlaylistDeckWidget,
  'net-meter': NetMeterWidget,
  'media-deck': MediaDeckWidget,
  'cd-ripper': CDRipperWidget,
  'signal-lab': SignalLabWidget,
  'broadcast-scheduler': BroadcastSchedulerWidget,
  'weather-console': WeatherConsoleWidget,
  'clock-tower': ClockTowerWidget,
  'newswire-desk': NewswireDeskWidget,
  'city-navigator': CityNavigatorWidget,
  'lcd-dolphins': LCDDolphinsWidget,
}

function resolveWidgetComponent(app: Application) {
  const widgetComponent = getWidgetComponent(app)
  if (!widgetComponent || widgetComponent === 'generic') return null
  return WIDGET_COMPONENTS[widgetComponent] ?? null
}

const THEME_CLASSNAME: Record<DesktopTheme, string> = {
  win98: 'desktop--theme-win98',
  'frutiger aero': 'desktop--theme-frutiger-aero',
  'y2k candy': 'desktop--theme-y2k-candy',
  'midnight chrome': 'desktop--theme-midnight-chrome',
  'sunset boulevard': 'desktop--theme-sunset-boulevard',
  'coastal glass': 'desktop--theme-coastal-glass',
  'amber terminal': 'desktop--theme-amber-terminal',
  custom: 'desktop--theme-custom',
}

interface ContextMenu {
  x: number
  y: number
  type: 'desktop' | 'icon'
  app?: Application
}

interface DesktopProps {
  apps: Application[]
}

type IconSize = NonNullable<Application['iconSize']>

interface IconDragSession {
  appId: string
  iconSize: IconSize
  pointerStart: { x: number; y: number }
  pointerOffset: { x: number; y: number }
  currentPosition: { x: number; y: number }
  moved: boolean
}

interface IconDragBroadcastState {
  lastSentAt: number
  rafId: number | null
  pending: DesktopIconDragPayload | null
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function adjustHexColor(input: string, delta: number) {
  const hex = input.replace('#', '')
  if (!/^[\da-fA-F]{6}$/.test(hex)) return input
  const r = clampChannel(parseInt(hex.slice(0, 2), 16) + delta)
  const g = clampChannel(parseInt(hex.slice(2, 4), 16) + delta)
  const b = clampChannel(parseInt(hex.slice(4, 6), 16) + delta)
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

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

const DEFAULT_DESKTOP_STYLE = DEFAULT_CONFIG.scenes[STATE.DESKTOP].style

function buildDesktopThemeVars(theme: DesktopTheme, accentColor: string, textColor: string, fontFamily: string): React.CSSProperties {
  const customAccent = accentColor.startsWith('#') ? accentColor : '#2f70c8'
  const customText = textColor || '#ffffff'
  const opaqueCustomText = opaqueHexColor(customText, '#ffffff')
  const hasAccentOverride = theme === 'custom' || (DEFAULT_DESKTOP_STYLE && customAccent.toLowerCase() !== DEFAULT_DESKTOP_STYLE.accentColor.toLowerCase())
  const hasTextOverride = theme === 'custom' || (DEFAULT_DESKTOP_STYLE && customText.toLowerCase() !== DEFAULT_DESKTOP_STYLE.textColor.toLowerCase())
  const hasFontOverride = fontFamily !== 'default' && (DEFAULT_DESKTOP_STYLE && fontFamily !== DEFAULT_DESKTOP_STYLE.fontFamily)

  const vars: Record<string, string> = {
    '--desktop-panel': '#c0c0c0',
    '--desktop-panel-light': '#ffffff',
    '--desktop-panel-dark': '#808080',
    '--desktop-panel-shadow': '#000000',
    '--desktop-title-start': '#000080',
    '--desktop-title-end': '#1084d0',
    '--desktop-title-text': '#ffffff',
    '--desktop-ui-font': 'MS Sans Serif, Arial, sans-serif',
    '--desktop-menu-hover': '#000080',
    '--desktop-menu-danger': '#800000',
    '--desktop-icon-label': '#ffffff',
    '--desktop-icon-shadow': '1px 1px 2px #000, -1px -1px 2px #000',
    '--desktop-tray-glow': 'rgba(0, 204, 0, 0.3)',
  }

  if (theme === 'y2k candy') {
    Object.assign(vars, {
      '--desktop-panel': '#ffe6fb',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#d76eb8',
      '--desktop-panel-shadow': '#772a72',
      '--desktop-title-start': '#ff7bc6',
      '--desktop-title-end': '#7bdcff',
      '--desktop-title-text': '#3d1140',
      '--desktop-ui-font': 'Trebuchet MS, Verdana, Arial, sans-serif',
      '--desktop-menu-hover': '#f05db3',
      '--desktop-menu-danger': '#bf4378',
      '--desktop-icon-shadow': '0 1px 2px rgba(65, 0, 70, 0.85)',
      '--desktop-tray-glow': 'rgba(255, 143, 216, 0.45)',
    })
  } else if (theme === 'frutiger aero') {
    Object.assign(vars, {
      '--desktop-panel': 'rgba(231, 247, 255, 0.92)',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#5b8fb8',
      '--desktop-panel-shadow': '#1f466f',
      '--desktop-title-start': '#2aa0e0',
      '--desktop-title-end': '#aef0ff',
      '--desktop-title-text': '#073c61',
      '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#1187d8',
      '--desktop-menu-danger': '#d24d4d',
      '--desktop-icon-shadow': '0 2px 6px rgba(0, 0, 0, 0.8)',
      '--desktop-tray-glow': 'rgba(55, 226, 255, 0.5)',
    })
  } else if (theme === 'midnight chrome') {
    Object.assign(vars, {
      '--desktop-panel': '#d8e2ef',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#667382',
      '--desktop-panel-shadow': '#0c1117',
      '--desktop-title-start': '#22384f',
      '--desktop-title-end': '#9ab8d8',
      '--desktop-title-text': '#f6fbff',
      '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#345c86',
      '--desktop-menu-danger': '#8c3849',
      '--desktop-icon-shadow': '0 2px 8px rgba(0, 0, 0, 0.9)',
      '--desktop-tray-glow': 'rgba(154, 184, 216, 0.4)',
    })
  } else if (theme === 'sunset boulevard') {
    Object.assign(vars, {
      '--desktop-panel': '#ffd8c8',
      '--desktop-panel-light': '#fff6f2',
      '--desktop-panel-dark': '#b96872',
      '--desktop-panel-shadow': '#4c1830',
      '--desktop-title-start': '#ff8b5f',
      '--desktop-title-end': '#ff5c8d',
      '--desktop-title-text': '#47101d',
      '--desktop-ui-font': 'Trebuchet MS, Verdana, Arial, sans-serif',
      '--desktop-menu-hover': '#d65475',
      '--desktop-menu-danger': '#8d2637',
      '--desktop-icon-shadow': '0 2px 6px rgba(48, 7, 18, 0.82)',
      '--desktop-tray-glow': 'rgba(255, 145, 109, 0.45)',
    })
  } else if (theme === 'coastal glass') {
    Object.assign(vars, {
      '--desktop-panel': 'rgba(229, 255, 252, 0.9)',
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': '#65a1a6',
      '--desktop-panel-shadow': '#123f43',
      '--desktop-title-start': '#3ac6bf',
      '--desktop-title-end': '#b4fff8',
      '--desktop-title-text': '#0a4044',
      '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#17989c',
      '--desktop-menu-danger': '#b44f4f',
      '--desktop-icon-shadow': '0 2px 6px rgba(0, 30, 32, 0.82)',
      '--desktop-tray-glow': 'rgba(148, 255, 244, 0.5)',
    })
  } else if (theme === 'amber terminal') {
    Object.assign(vars, {
      '--desktop-panel': '#d1a45b',
      '--desktop-panel-light': '#f6ddaf',
      '--desktop-panel-dark': '#74531f',
      '--desktop-panel-shadow': '#130d05',
      '--desktop-title-start': '#5b360d',
      '--desktop-title-end': '#be7c22',
      '--desktop-title-text': '#ffe0a0',
      '--desktop-ui-font': 'Lucida Console, Courier New, monospace',
      '--desktop-menu-hover': '#8e5d16',
      '--desktop-menu-danger': '#7a2d1d',
      '--desktop-icon-label': '#ffd77a',
      '--desktop-icon-shadow': '0 0 10px rgba(0, 0, 0, 0.9)',
      '--desktop-tray-glow': 'rgba(255, 186, 74, 0.45)',
    })
  } else if (theme === 'custom') {
    Object.assign(vars, {
      '--desktop-panel': adjustHexColor(customAccent, 110),
      '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': adjustHexColor(customAccent, -35),
      '--desktop-panel-shadow': adjustHexColor(customAccent, -95),
      '--desktop-title-start': adjustHexColor(customAccent, -20),
      '--desktop-title-end': adjustHexColor(customAccent, 35),
      '--desktop-title-text': customText,
      '--desktop-ui-font': 'Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': adjustHexColor(customAccent, -25),
      '--desktop-menu-danger': '#9f2d41',
      '--desktop-icon-label': opaqueCustomText,
      '--desktop-tray-glow': `${customAccent}55`,
    })
  }

  if (theme !== 'custom' && hasAccentOverride) {
    vars['--desktop-title-end'] = customAccent
    vars['--desktop-menu-hover'] = customAccent
    vars['--desktop-tray-glow'] = `${customAccent}55`
  }

  if (theme !== 'custom' && hasTextOverride) {
    vars['--desktop-title-text'] = customText
    vars['--desktop-icon-label'] = opaqueCustomText
  }

  if (hasFontOverride) {
    vars['--desktop-ui-font'] = buildFontStack(fontFamily, vars['--desktop-ui-font'])
  }

  return vars as React.CSSProperties
}

function buildWidgetThemeVars(widgetTheme: WidgetThemeConfig): React.CSSProperties {
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

  return vars as React.CSSProperties
}

// ── Icon grid layout ──────────────────────────────────────────
// Slot dimensions: icon area + padding + label + inter-icon gap
const ICON_SLOT_W: Record<IconSize, number> = { small: 68, normal: 84, large: 106 }
const ICON_RENDER_W: Record<IconSize, number> = { small: 60, normal: 76, large: 90 }
const ICON_RENDER_H: Record<IconSize, number> = { small: 74, normal: 86, large: 98 }
const ICON_SLOT_H  = 88
const DESKTOP_PAD  = 16
const TASKBAR_H    = 40
const CANVAS_H     = 1080
const DRAG_THRESHOLD_PX = 4

function resolveWidgetStackPreference(
  widgetId: string,
  runtimeZIndices: Record<string, number>,
  defaultZIndices: Record<string, number>,
) {
  const runtimeValue = runtimeZIndices[widgetId]
  if (Number.isFinite(runtimeValue)) return runtimeValue as number
  const defaultValue = defaultZIndices[widgetId]
  if (Number.isFinite(defaultValue)) return defaultValue as number
  return Number.MAX_SAFE_INTEGER
}

function sortWidgetIdsByStackPreference(
  widgetIds: string[],
  runtimeZIndices: Record<string, number>,
  defaultZIndices: Record<string, number>,
) {
  return [...widgetIds].sort((a, b) => (
    resolveWidgetStackPreference(a, runtimeZIndices, defaultZIndices)
    - resolveWidgetStackPreference(b, runtimeZIndices, defaultZIndices)
  ))
}

function orderVisibleWidgetIds(
  widgetIds: string[],
  runtimeZIndices: Record<string, number>,
  defaultZIndices: Record<string, number>,
) {
  if (widgetIds.some((id) => runtimeZIndices[id] !== undefined)) {
    return sortWidgetIdsByStackPreference(widgetIds, runtimeZIndices, defaultZIndices)
  }
  if (widgetIds.some((id) => defaultZIndices[id] !== undefined)) {
    return sortWidgetIdsByStackPreference(widgetIds, {}, defaultZIndices)
  }

  const nonCameraIds = widgetIds.filter((id) => !/^camera(?:[-:_].+)?$/.test(id))
  const cameraIds = widgetIds.filter((id) => /^camera(?:[-:_].+)?$/.test(id))
  return [...nonCameraIds, ...cameraIds]
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolveIconSize(app: Application, defaultIconSize: IconSize): IconSize {
  return app.iconSize ?? defaultIconSize
}

function clampIconPosition(
  position: { x: number; y: number },
  iconSize: IconSize,
  bounds: { width: number; height: number },
) {
  return {
    x: clamp(position.x, 0, Math.max(0, bounds.width - ICON_RENDER_W[iconSize] - DESKTOP_PAD)),
    y: clamp(position.y, 0, Math.max(0, bounds.height - TASKBAR_H - ICON_RENDER_H[iconSize] - DESKTOP_PAD)),
  }
}

/**
 * Assigns a top-to-bottom, left-to-right column grid position to each app
 * in the supplied list. Apps are slotted in order; the first column fills
 * from top to bottom before the next column begins (Win98 style).
 */
function computeGridPositions(
  apps: Application[],
  defaultIconSize: IconSize,
): Map<string, { x: number; y: number }> {
  const slotW     = ICON_SLOT_W[defaultIconSize] ?? ICON_SLOT_W.normal
  const availH    = CANVAS_H - TASKBAR_H - DESKTOP_PAD * 2
  const perColumn = Math.max(1, Math.floor(availH / ICON_SLOT_H))
  const result    = new Map<string, { x: number; y: number }>()

  apps.forEach((app, idx) => {
    const col = Math.floor(idx / perColumn)
    const row = idx % perColumn
    result.set(app.id, {
      x: DESKTOP_PAD + col * slotW,
      y: DESKTOP_PAD + row * ICON_SLOT_H,
    })
  })

  return result
}

/** Fallback draggable window for any widget ID not registered in WIDGET_COMPONENTS */
function GenericWidget({ app, onClose, onMinimize, onFocus, windowState = 'open', zIndex }: { app: Application } & DesktopWidgetProps) {
  return (
    <DesktopWindow
      id={app.id}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AppGlyph icon={app.icon} label={app.label} size={16} /> <span>{app.label}</span></span>}
      width={260}
      height={240}
      defaultPosition={{ x: 80, y: 120 }}
      zIndex={zIndex}
      state={windowState}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px 16px', color: 'var(--desktop-title-start)', textAlign: 'center' }}
    >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AppGlyph icon={app.icon} label={app.label} size={28} />
        </div>
        <div style={{ marginTop: 6, fontWeight: 'bold' }}>{app.label}</div>
        <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>Widget — no component registered for id: {app.id}</div>
    </DesktopWindow>
  )
}

export function Desktop({ apps }: DesktopProps) {
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [startMenuActiveRoot, setStartMenuActiveRoot] = useState<DesktopStartMenuRoot>(null)
  const [startMenuSimulationPhase, setStartMenuSimulationPhase] = useState<DesktopStartMenuSimulationPhasePayload | null>(null)
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null)
  const [windowOrder, setWindowOrder]     = useState<string[]>([])
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [draggingId, setDraggingId]       = useState<string | null>(null)
  const [simulationLeaderId, setSimulationLeaderId] = useState<string | null>(null)

  const openWidgets = useAppStore((s) => s.openWidgets)
  const closingWidgets = useAppStore((s) => s.closingWidgets)
  const minimizedWidgets = useAppStore((s) => s.minimizedWidgets)
  const minimizeWidget = useAppStore((s) => s.minimizeWidget)
  const restoreWidget = useAppStore((s) => s.restoreWidget)
  const enqueueDesktopNotification = useAppStore((s) => s.enqueueDesktopNotification)
  const recycleBinFull = useAppStore((s) => s.recycleBinFull)
  const reactiveIconId = useAppStore((s) => s.reactiveIconId)

  const desktopRef = useRef<HTMLDivElement>(null)
  const iconDragRef = useRef<IconDragSession | null>(null)
  const suppressClickRef = useRef(false)
  const simEmittingRef = useRef(false)
  const ambianceQueueRef = useRef<AmbianceSimulationPayload[]>([])
  const ambianceRunningRef = useRef(false)
  const suppressZIndexPersistRef = useRef(false)
  const pendingDefaultSeedWidgetIdsRef = useRef<Set<string>>(new Set())
  const sourceCenterToggleRef = useRef<string>(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter)
  const iconDragBroadcastRef = useRef<IconDragBroadcastState>({
    lastSentAt: 0,
    rafId: null,
    pending: null,
  })

  const config = useAppStore((s) => s.config)
  const desktopConfig = useMemo(() => withDesktopConfigDefaults(config.desktopConfig), [config.desktopConfig])
  const desktopConfigRef = useRef(desktopConfig)
  desktopConfigRef.current = desktopConfig
  const desktopScene = config.scenes[STATE.DESKTOP] as { style?: OverlayStyle } | undefined
  const supportedApps = useMemo(() => apps, [apps])

  const isSimulationLeader = simulationLeaderId !== null && simulationLeaderId === socket.id;
  const isEmbeddedPreview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    const onLeader = (payload: { socketId: string | null }) => {
      setSimulationLeaderId(payload.socketId)
    }

    const requestLeader = () => {
      socket.emit('ambiance:leader:request', (payload: { socketId: string | null }) => {
        setSimulationLeaderId(payload.socketId)
      })
    }

    socket.on('ambiance:leader', onLeader)
    socket.on('connect', requestLeader)
    if (socket.connected) requestLeader()
    return () => {
      socket.off('ambiance:leader', onLeader)
      socket.off('connect', requestLeader)
    }
  }, [])

  useEffect(() => {
    const applyStartMenuState = (payload: DesktopStartMenuStatePayload) => {
      setStartMenuOpen(payload.open)
      setStartMenuActiveRoot(payload.open ? payload.activeRoot : null)
      if (!payload.open) {
        setStartMenuSimulationPhase(null)
        setContextMenu(null)
      }
    }

    const applyStartMenuSimulationPhase = (payload: DesktopStartMenuSimulationPhasePayload) => {
      if (payload.phase === 'clear') {
        setStartMenuSimulationPhase(null)
        return
      }
      setStartMenuSimulationPhase(payload)
    }

    socket.on('desktop:start-menu:state', applyStartMenuState)
    socket.on('desktop:start-menu:phase', applyStartMenuSimulationPhase)
    return () => {
      socket.off('desktop:start-menu:state', applyStartMenuState)
      socket.off('desktop:start-menu:phase', applyStartMenuSimulationPhase)
    }
  }, [])

  const emitStartMenuState = useCallback((payload: DesktopStartMenuStatePayload) => {
    setStartMenuOpen(payload.open)
    setStartMenuActiveRoot(payload.open ? payload.activeRoot : null)
    socket.emit('desktop:start-menu:state', payload)
  }, [])

  useEffect(() => {
    const requestDesktopRuntimeState = () => {
      socket.emit('desktop:state:request', (payload: DesktopRuntimeStatePayload) => {
        const nextState = payload.startMenuState ?? { open: false, activeRoot: null }
        setStartMenuOpen(nextState.open)
        setStartMenuActiveRoot(nextState.open ? nextState.activeRoot : null)
      })
    }

    socket.on('connect', requestDesktopRuntimeState)
    if (socket.connected) {
      requestDesktopRuntimeState()
    }

    return () => {
      socket.off('connect', requestDesktopRuntimeState)
    }
  }, [])

  useEffect(() => {
    const cursor = (window as any).__cursorOverlayController;
    if (isEmbeddedPreview) return;
    if (!isSimulationLeader) return;
    if (!cursor) return;

    cursor.setVisible(true);

    const runAmbianceSimulation = async (payload: AmbianceSimulationPayload) => {
      const startedAt = Date.now();
      let ok = false;
      try {
        const app = supportedApps.find((candidate) => candidate.id === payload.widgetId && candidate.appType === 'widget');
        if (!app) return;

        if (payload.action === 'close') {
          simEmittingRef.current = true;
          try {
            await closeWidgetByWindowButton(cursor, app.id, app.label);
            await new Promise((resolve) => setTimeout(resolve, 140));
            if (useAppStore.getState().openWidgets.has(app.id)) {
              socket.emit('widget:simulate:action', { widgetId: app.id, action: 'close' });
            }
            ok = true;
          } finally {
            simEmittingRef.current = false;
          }
          return;
        }

        if (payload.action === 'open') {
          const recipe = getWidgetSimulationRecipe(app);
          const menuPath = recipe.menuPath(app);
          const timeline = buildOpenWidgetMenuTimeline(app.label, menuPath, app.id);
          socket.emit('cursor:mirror:menu-timeline', timeline);
          simEmittingRef.current = true;
          try {
            const wasOpen = useAppStore.getState().openWidgets.has(app.id);
            await runWidgetCursorSimulation(cursor, app.label, {
              startMenu: false,
              menuPath,
              visualOnly: true,
              driveCursorVisualOnly: true,
              allowDomActionsInVisualOnly: false,
              targetAppId: app.id,
              activateLeafClick: false,
              openFirstLevelOnHover: true,
              onPhase: (phasePayload) => {
                if (phasePayload.phase === 'open') {
                  emitStartMenuState({ open: true, activeRoot: null })
                }
                socket.emit('desktop:start-menu:phase', phasePayload)
              },
              debugTag: `leader:${payload.actionId}:${app.id}`,
              closeStartMenuAfterPath: false,
              timingPlan: {
                startMoveMs: timeline.startMoveMs,
                startPostMs: timeline.startPostMs,
                steps: timeline.steps,
              },
            });
            if (!wasOpen) {
              socket.emit('widget:simulate:action', { widgetId: app.id, action: 'open' });
            }
            ok = true;
          } finally {
            socket.emit('desktop:start-menu:phase', { phase: 'clear' })
            emitStartMenuState({ open: false, activeRoot: null });
            simEmittingRef.current = false;
          }
          return;
        }

        const recipe = getWidgetSimulationRecipe(app);
        const step = pickWidgetInteractionStep(recipe);
        if (!step) {
          ok = true;
          return;
        }

        // Interact mode can also animate organic window movement and resize,
        // which then fan out through desktop:widget:drag/resize live events.
        const windowMotionRoll = Math.random();
        if (windowMotionRoll < 0.2) {
          await simulateWidgetWindowDrag(cursor, app.id);
          ok = true;
          return;
        }
        if (windowMotionRoll < 0.32) {
          await simulateWidgetWindowResize(cursor, app.id);
          ok = true;
          return;
        }

        await interactWithWidgetByRecipe(cursor, app.id, step.selectors, {
          moveMinMs: step.moveMinMs,
          moveMaxMs: step.moveMaxMs,
          postDelayMinMs: step.postDelayMinMs,
          postDelayMaxMs: step.postDelayMaxMs,
        });
        ok = true;
      } catch {
        ok = false;
      } finally {
        socket.emit('ambiance:simulate:done', {
          actionId: payload.actionId,
          widgetId: payload.widgetId,
          action: payload.action,
          ok,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    const drainAmbianceQueue = () => {
      if (ambianceRunningRef.current) return
      const next = ambianceQueueRef.current.shift()
      if (!next) return
      ambianceRunningRef.current = true
      void runAmbianceSimulation(next).finally(() => {
        ambianceRunningRef.current = false
        drainAmbianceQueue()
      })
    }

    const onAmbianceSimulate = (payload: AmbianceSimulationPayload) => {
      ambianceQueueRef.current.push(payload)
      drainAmbianceQueue()
    }

    socket.on('ambiance:simulate', onAmbianceSimulate);
    return () => {
      socket.off('ambiance:simulate', onAmbianceSimulate);
      ambianceQueueRef.current = []
      ambianceRunningRef.current = false
      simEmittingRef.current = false;
      emitStartMenuState({ open: false, activeRoot: null });
      cursor.setVisible(false);
    };
  }, [emitStartMenuState, isEmbeddedPreview, isSimulationLeader, supportedApps]);

  const themeStyle = useMemo(
    () => ({
      ...buildDesktopThemeVars(
        desktopConfig.theme,
        desktopScene?.style?.accentColor ?? config.overlayStyle.accentColor,
        desktopScene?.style?.textColor ?? config.overlayStyle.textColor,
        desktopScene?.style?.fontFamily ?? config.overlayStyle.fontFamily,
      ),
      ...buildWidgetThemeVars(desktopConfig.widgetTheme),
    }),
    [
      config.overlayStyle.accentColor,
      config.overlayStyle.fontFamily,
      config.overlayStyle.textColor,
      desktopConfig.theme,
      desktopConfig.widgetTheme,
      desktopScene?.style?.accentColor,
      desktopScene?.style?.fontFamily,
      desktopScene?.style?.textColor,
    ],
  )

  const desktopApps = useMemo(
    () => supportedApps.map((app) => {
      if (app.id !== 'recycle-bin') return app
      return {
        ...app,
        icon: recycleBinFull
          ? (app.recycleBinSettings?.fullIcon ?? app.icon)
          : (app.recycleBinSettings?.emptyIcon ?? app.icon),
      }
    }),
    [supportedApps, recycleBinFull],
  )

  const autoArrangeIcons = desktopConfig.autoArrangeIcons
  const defaultIconSize  = desktopConfig.defaultIconSize

  // Compute collision-free grid positions. In auto-arrange mode every icon
  // gets a grid slot. In manual mode only icons without a saved iconPosition
  // get a fallback slot so they don't pile on top of positioned siblings.
  const gridPositions = useMemo(() => {
    const toArrange = autoArrangeIcons
      ? desktopApps
      : desktopApps.filter((a) => !a.iconPosition)
    return computeGridPositions(toArrange, defaultIconSize)
  }, [desktopApps, autoArrangeIcons, defaultIconSize])

  const launchableApps = useMemo(
    () => desktopApps.filter((app) => app.appType !== 'decoration'),
    [desktopApps],
  )
  const widgetAppById = useMemo(
    () => new Map(apps.filter((app) => app.appType === 'widget').map((app) => [app.id, app])),
    [apps],
  )

  const visibleWidgets = useMemo(
    () => desktopApps.filter((app) => (
      app.appType === 'widget'
      && (openWidgets.has(app.id) || closingWidgets.has(app.id))
      && !minimizedWidgets.has(app.id)
    )),
    [closingWidgets, desktopApps, minimizedWidgets, openWidgets],
  )

  useEffect(() => {
    setWindowOrder((prev) => {
      const ids = visibleWidgets.map((widget) => widget.id)
      const next = prev.filter((id) => ids.includes(id))
      const newIds = ids.filter((id) => !next.includes(id))
      if (newIds.length === 0) return next.length === prev.length ? prev : next

      const defaultZIndices = desktopConfigRef.current.widgetDefaultZIndices ?? {}

      if (suppressZIndexPersistRef.current) {
        const runtimeZIndices = desktopConfigRef.current.widgetZIndices ?? {}
        return orderVisibleWidgetIds(ids, runtimeZIndices, defaultZIndices)
      }

      const persistedZIndices = desktopConfigRef.current.widgetZIndices ?? {}
      const runtimeZIndices = { ...persistedZIndices }
      newIds.forEach((id) => {
        pendingDefaultSeedWidgetIdsRef.current.add(id)
        delete runtimeZIndices[id]
      })

      const nextOrderedIds = orderVisibleWidgetIds(ids, runtimeZIndices, defaultZIndices)
      const nextOpenWidgetZIndices = Object.fromEntries(nextOrderedIds.map((id, idx) => [id, idx]))
      const nextPersistedZIndices = { ...persistedZIndices, ...nextOpenWidgetZIndices }

      patchDesktopConfig({ widgetZIndices: nextPersistedZIndices })
        .catch(() => {})
        .finally(() => {
          newIds.forEach((id) => pendingDefaultSeedWidgetIdsRef.current.delete(id))
        })

      return nextOrderedIds
    })
  }, [visibleWidgets])

  useEffect(() => {
    const runtimeZIndices = { ...(desktopConfig.widgetZIndices ?? {}) }
    pendingDefaultSeedWidgetIdsRef.current.forEach((id) => {
      delete runtimeZIndices[id]
    })
    const defaultZIndices = desktopConfig.widgetDefaultZIndices ?? {}
    const visibleIds = visibleWidgets.map((widget) => widget.id)
    if (!visibleIds.some((id) => runtimeZIndices[id] !== undefined)) return

    const sortedVisibleIds = orderVisibleWidgetIds(visibleIds, runtimeZIndices, defaultZIndices)
    setWindowOrder((prev) => {
      if (prev.length === sortedVisibleIds.length && prev.every((id, idx) => id === sortedVisibleIds[idx])) {
        return prev
      }
      return sortedVisibleIds
    })
  }, [desktopConfig.widgetDefaultZIndices, desktopConfig.widgetZIndices, visibleWidgets])

  const focusWidget = useCallback((widgetId: string) => {
    setWindowOrder((prev) => {
      const next = prev.filter((id) => id !== widgetId)
      next.push(widgetId)
      if (suppressZIndexPersistRef.current) {
        return next
      }
      // Persist updated z-order so it survives reconnects
      const currentZIndices = desktopConfigRef.current.widgetZIndices ?? {}
      const nextOpenWidgetZIndices = Object.fromEntries(next.map((id, idx) => [id, idx]))
      const zIndices = { ...currentZIndices, ...nextOpenWidgetZIndices }
      patchDesktopConfig({ widgetZIndices: zIndices }).catch(() => {})
      return next
    })
  }, [])

  const getWidgetZIndex = useCallback((widgetId: string) => {
    const idx = windowOrder.indexOf(widgetId)
    return 60 + (idx >= 0 ? idx : 0)
  }, [windowOrder])

  const handleTaskbarWidgetClick = useCallback((widgetId: string) => {
    if (!openWidgets.has(widgetId)) return

    if (minimizedWidgets.has(widgetId)) {
      restoreWidget(widgetId)
      focusWidget(widgetId)
      return
    }

    const visibleOrder = windowOrder.filter((id) => (
      openWidgets.has(id)
      && !minimizedWidgets.has(id)
      && !closingWidgets.has(id)
    ))
    const topVisibleId = visibleOrder.length > 0 ? visibleOrder[visibleOrder.length - 1] : null

    if (topVisibleId === widgetId) {
      minimizeWidget(widgetId)
      return
    }

    focusWidget(widgetId)
  }, [closingWidgets, focusWidget, minimizeWidget, minimizedWidgets, openWidgets, restoreWidget, windowOrder])

  const ss = desktopConfig.screenSaver

  const clearDragOverride = useCallback((appId: string) => {
    setDragPositions((prev) => {
      if (!(appId in prev)) return prev
      const next = { ...prev }
      delete next[appId]
      return next
    })
  }, [])

  const emitIconDrag = useCallback((payload: DesktopIconDragPayload, immediate = false) => {
    if (!socket.connected) return

    const broadcastState = iconDragBroadcastRef.current
    const flush = (next: DesktopIconDragPayload) => {
      socket.emit('desktop:icon:drag', next)
      broadcastState.lastSentAt = Date.now()
    }

    if (immediate || payload.phase !== 'move') {
      if (broadcastState.rafId !== null) {
        window.cancelAnimationFrame(broadcastState.rafId)
        broadcastState.rafId = null
        broadcastState.pending = null
      }
      flush(payload)
      return
    }

    const now = Date.now()
    if (now - broadcastState.lastSentAt >= 33) {
      flush(payload)
      return
    }

    broadcastState.pending = payload
    if (broadcastState.rafId !== null) return

    broadcastState.rafId = window.requestAnimationFrame(() => {
      broadcastState.rafId = null
      const pending = broadcastState.pending
      broadcastState.pending = null
      if (!pending) return
      flush(pending)
    })
  }, [])

  const consumeClickSuppression = useCallback(() => {
    const suppressed = suppressClickRef.current
    suppressClickRef.current = false
    return suppressed
  }, [])

  const resolveIconPosition = useCallback((app: Application) => {
    return dragPositions[app.id]
      ?? (autoArrangeIcons ? gridPositions.get(app.id) : (app.iconPosition ?? gridPositions.get(app.id)))
  }, [autoArrangeIcons, dragPositions, gridPositions])

  useEffect(() => {
    return () => {
      const broadcastState = iconDragBroadcastRef.current
      if (broadcastState.rafId !== null) {
        window.cancelAnimationFrame(broadcastState.rafId)
      }
    }
  }, [])

  useEffect(() => {
    const onRemoteIconDrag = (payload: DesktopIconDragPayload) => {
      if (autoArrangeIcons) return

      const app = desktopApps.find((entry) => entry.id === payload.appId)
      if (!app) return

      const desktopBounds = desktopRef.current?.getBoundingClientRect()
      const iconSize = resolveIconSize(app, defaultIconSize)
      const nextPosition = desktopBounds
        ? clampIconPosition(
            { x: payload.x, y: payload.y },
            iconSize,
            { width: desktopBounds.width, height: desktopBounds.height },
          )
        : { x: payload.x, y: payload.y }

      setDragPositions((prev) => {
        const current = prev[payload.appId]
        if (current && current.x === nextPosition.x && current.y === nextPosition.y) return prev
        return { ...prev, [payload.appId]: nextPosition }
      })

      if (payload.phase === 'start' || payload.phase === 'move') {
        if (!iconDragRef.current) setDraggingId(payload.appId)
        return
      }

      if (!iconDragRef.current) {
        setDraggingId((prev) => (prev === payload.appId ? null : prev))
      }
    }

    socket.on('desktop:icon:drag', onRemoteIconDrag)
    return () => {
      socket.off('desktop:icon:drag', onRemoteIconDrag)
    }
  }, [autoArrangeIcons, defaultIconSize, desktopApps])

  useEffect(() => {
    setDragPositions((prev) => {
      let changed = false
      const next = { ...prev }

      for (const [appId, pos] of Object.entries(prev)) {
        const app = desktopApps.find((entry) => entry.id === appId)
        if (!app?.iconPosition) continue
        const isLocallyDragging = iconDragRef.current?.appId === appId
        const isVisuallyDragging = draggingId === appId
        if (isLocallyDragging || isVisuallyDragging) continue
        if (app.iconPosition.x !== pos.x || app.iconPosition.y !== pos.y) continue
        delete next[appId]
        changed = true
      }

      return changed ? next : prev
    })
  }, [desktopApps, draggingId])

  useEffect(() => {
    if (!autoArrangeIcons) return
    iconDragRef.current = null
    setDraggingId(null)
    setDragPositions({})
  }, [autoArrangeIcons])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const session = iconDragRef.current
      const desktopBounds = desktopRef.current?.getBoundingClientRect()
      if (!session || !desktopBounds || autoArrangeIcons) return

      const movedEnough = Math.hypot(
        event.clientX - session.pointerStart.x,
        event.clientY - session.pointerStart.y,
      ) >= DRAG_THRESHOLD_PX

      if (!session.moved && !movedEnough) return
      if (!session.moved) {
        session.moved = true
        setSelectedId(null)
        setDraggingId(session.appId)
      }

      const next = clampIconPosition(
        {
          x: event.clientX - desktopBounds.left - session.pointerOffset.x,
          y: event.clientY - desktopBounds.top - session.pointerOffset.y,
        },
        session.iconSize,
        { width: desktopBounds.width, height: desktopBounds.height },
      )

      session.currentPosition = next
      setDragPositions((prev) => {
        const current = prev[session.appId]
        if (current && current.x === next.x && current.y === next.y) return prev
        return { ...prev, [session.appId]: next }
      })
      emitIconDrag({ appId: session.appId, x: next.x, y: next.y, phase: 'move' })
    }

    const handleMouseUp = () => {
      const session = iconDragRef.current
      if (!session) return

      iconDragRef.current = null
      setDraggingId(null)

      if (!session.moved) return

      suppressClickRef.current = true
      emitIconDrag({ appId: session.appId, x: session.currentPosition.x, y: session.currentPosition.y, phase: 'end' }, true)
      patchApplicationConfig(session.appId, { iconPosition: session.currentPosition })
        .then(() => clearDragOverride(session.appId))
        .catch(() => clearDragOverride(session.appId))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [autoArrangeIcons, clearDragOverride, emitIconDrag])

  const handleLaunch = (app: Application) => {
    setSelectedId(null)
    emitStartMenuState({ open: false, activeRoot: null })

    if ((window as any).__cursorMirrorVisualOnly) {
      return
    }

    if (app.appType === 'widget') {
      if (simEmittingRef.current) socket.emit('widget:simulate:action', { widgetId: app.id, action: 'toggle' })
      else socket.emit('widget:toggle', app.id)
      return
    }
    if (app.appType !== 'scene') return

    if (app.launchPipeline && app.launchPipeline.effects.length > 0) {
      socket.emit('overlay:trigger', {
        id: `launch-${app.id}`,
        effects: app.launchPipeline.effects,
      })
      setTimeout(() => {
        socket.emit('scene:change', app.targetSceneId as STATE)
      }, app.launchPipeline.delayMs)
    } else {
      socket.emit('scene:change', app.targetSceneId as STATE)
    }
  }

  const handleDesktopMouseDown = () => {
    if ((window as any).__simulatingCursorClick) return
    if ((window as any).__simulatingWidgetFocus) return
    setSelectedId(null)
    emitStartMenuState({ open: false, activeRoot: null })
    setContextMenu(null)
  }

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    emitStartMenuState({ open: false, activeRoot: null })
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'desktop' })
  }

  const handleIconMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, app: Application) => {
    if (event.button !== 0 || autoArrangeIcons) return

    const desktopBounds = desktopRef.current?.getBoundingClientRect()
    const position = resolveIconPosition(app)
    if (!desktopBounds || !position) return

    emitStartMenuState({ open: false, activeRoot: null })
    setContextMenu(null)

    iconDragRef.current = {
      appId: app.id,
      iconSize: resolveIconSize(app, defaultIconSize),
      pointerStart: { x: event.clientX, y: event.clientY },
      pointerOffset: {
        x: event.clientX - desktopBounds.left - position.x,
        y: event.clientY - desktopBounds.top - position.y,
      },
      currentPosition: position,
      moved: false,
    }

    emitIconDrag({ appId: app.id, x: position.x, y: position.y, phase: 'start' }, true)

    event.preventDefault()
    event.stopPropagation()
  }, [autoArrangeIcons, defaultIconSize, emitIconDrag, emitStartMenuState, resolveIconPosition])

  const handleIconContextMenu = useCallback((e: React.MouseEvent, app: Application) => {
    e.preventDefault()
    e.stopPropagation()
    emitStartMenuState({ open: false, activeRoot: null })
    const rect = (desktopRef.current ?? document.body).getBoundingClientRect()
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, type: 'icon', app })
  }, [emitStartMenuState])

  const closeMenus = useCallback(() => {
    emitStartMenuState({ open: false, activeRoot: null })
    setContextMenu(null)
  }, [emitStartMenuState])

  const applyWidgetLayoutById = useCallback((layoutId: string) => {
    socket.emit('widget:layout:apply', layoutId)
    closeMenus()
  }, [closeMenus])

  useEffect(() => {
    const handleSavedWidgetLayoutApply = (layoutId: string) => {
      const layout = (desktopConfigRef.current.widgetLayouts ?? []).find((entry) => entry.id === layoutId)
      if (!layout) return

      const defaultZIndices = desktopConfigRef.current.widgetDefaultZIndices ?? {}
      const nextOrder = [...layout.items]
        .filter((item) => item.enabled)
        .sort((a, b) => {
          if (a.focusPriority !== b.focusPriority) return a.focusPriority - b.focusPriority
          return (defaultZIndices[a.widgetId] ?? 0) - (defaultZIndices[b.widgetId] ?? 0)
        })
        .map((item) => item.widgetId)

      const store = useAppStore.getState()
      suppressZIndexPersistRef.current = true
      layout.items.forEach((item) => {
        if (item.enabled && store.minimizedWidgets.has(item.widgetId)) {
          store.restoreWidget(item.widgetId)
        }
      })
      setWindowOrder((prev) => {
        const openWidgetIds = useAppStore.getState().openWidgets
        const visibleOrder = nextOrder.filter((widgetId) => openWidgetIds.has(widgetId))
        const others = prev.filter((widgetId) => openWidgetIds.has(widgetId) && !visibleOrder.includes(widgetId))
        return [...others, ...visibleOrder]
      })
      if (layoutId === DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter) {
        sourceCenterToggleRef.current = DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter
      } else if (layoutId === DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter) {
        sourceCenterToggleRef.current = DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter
      }
      enqueueDesktopNotification({
        title: 'Widget Layouts',
        body: `Layout applied: ${layout.label}`,
        durationMs: 2200,
      })
      setTimeout(() => {
        suppressZIndexPersistRef.current = false
      }, 500)
      closeMenus()
    }

    socket.on('widget:layout:apply', handleSavedWidgetLayoutApply)
    return () => {
      socket.off('widget:layout:apply', handleSavedWidgetLayoutApply)
    }
  }, [closeMenus, enqueueDesktopNotification])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.ctrlKey) return
      if (event.repeat) return
      if (isTypingTarget(event.target)) return

      const key = event.key
      if (key === '1') {
        event.preventDefault()
        applyWidgetLayoutById(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceACenter)
        return
      }
      if (key === '2') {
        event.preventDefault()
        applyWidgetLayoutById(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraSourceBCenter)
        return
      }
      if (key === '3') {
        event.preventDefault()
        applyWidgetLayoutById(sourceCenterToggleRef.current)
        return
      }
      if (key === '0') {
        event.preventDefault()
        applyWidgetLayoutById(DEFAULT_SYSTEM_WIDGET_LAYOUT_IDS.cameraDirectTalk)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyWidgetLayoutById])

  const iconMenuLaunchable = contextMenu?.app?.appType === 'scene' || contextMenu?.app?.appType === 'widget'
  const simProgramsOpen = startMenuSimulationPhase?.phase === 'programs-open'
    || startMenuSimulationPhase?.phase === 'target-hover'
    || startMenuSimulationPhase?.phase === 'target-select'
  const simProgramsHover = startMenuSimulationPhase?.phase === 'programs-hover'
  const simTargetAppId = startMenuSimulationPhase?.targetAppId
  const simTargetHover = startMenuSimulationPhase?.phase === 'target-hover' || startMenuSimulationPhase?.phase === 'target-select'
  const widgetLayouts = desktopConfig.widgetLayouts ?? []
  const systemWidgetLayouts = widgetLayouts.filter((layout) => layout.source === 'system')
  const userWidgetLayouts = widgetLayouts.filter((layout) => layout.source === 'user')
  const orderedWidgetLayouts = [...systemWidgetLayouts, ...userWidgetLayouts]
  const widgetSkinClassName = `desktop--widget-skin-${desktopConfig.widgetTheme.skin.replace(/\s+/g, '-')}`
  const widgetAnimationClassName = `desktop--widget-animation-${desktopConfig.widgetTheme.animation}`
  const widgetAtmosphereClassName = `desktop--widget-atmosphere-${desktopConfig.widgetTheme.atmosphere}`

  return (
    <CursorOverlayProvider>
      <CursorSimExample />
      <div
        ref={desktopRef}
        className={`desktop ${THEME_CLASSNAME[desktopConfig.theme]} ${widgetSkinClassName} ${widgetAnimationClassName} ${widgetAtmosphereClassName}`}
        style={themeStyle}
        onMouseDown={handleDesktopMouseDown}
        onContextMenu={handleDesktopContextMenu}
      >
        {/* Desktop icon canvas */}
        <div className="desktop-icons" onMouseDown={(e) => e.stopPropagation()}>
          {desktopApps.map((app, index) => {
            const resolvedPos = resolveIconPosition(app)
            const resolvedSize = resolveIconSize(app, defaultIconSize)
            return (
              <AppIcon
                key={app.id}
                app={app}
                position={resolvedPos}
                size={resolvedSize}
                selected={selectedId === app.id}
                animationMode={desktopConfig.iconAnimation}
                motionAmount={desktopConfig.iconMotion}
                animationSeed={index}
                reactive={desktopConfig.iconAnimation === 'reactive' && reactiveIconId === app.id}
                draggable={!autoArrangeIcons}
                dragging={draggingId === app.id}
                onSelect={() => { setSelectedId(app.id); closeMenus() }}
                onLaunch={() => handleLaunch(app)}
                onMouseDown={(event) => handleIconMouseDown(event, app)}
                consumeClickSuppression={consumeClickSuppression}
                onContextMenu={(e) => handleIconContextMenu(e, app)}
              />
            )
          })}
        </div>

        {/* Start Menu */}
        {startMenuOpen && (
          <div className="start-menu" onMouseDown={(e) => e.stopPropagation()}>
            <div className="start-menu-banner">
              <span className="start-menu-banner-text">IEOM</span>
            </div>
            <div
              className="start-menu-items"
              onMouseLeave={() => {
                if (!startMenuOpen) return
                emitStartMenuState({ open: true, activeRoot: null })
              }}
            >
              {/* Programs sub-list */}
              <div
                className={`start-menu-item start-menu-item--has-sub${startMenuActiveRoot === 'programs' || simProgramsOpen ? ' start-menu-item--sim-open' : ''}${simProgramsHover ? ' start-menu-item--sim-hover' : ''}`}
                onMouseEnter={() => emitStartMenuState({ open: true, activeRoot: 'programs' })}
              >
                <span className="start-menu-item-icon">📂</span>
                <span className="start-menu-item-label">Programs</span>
                <span className="start-menu-item-arrow">▶</span>
                <div className="start-menu-sub">
                  {launchableApps.map((app) => (
                    <button
                      key={app.id}
                      className={`start-menu-sub-item${simTargetHover && simTargetAppId === app.id ? ' start-menu-sub-item--sim-hover' : ''}`}
                      data-start-app-id={app.id}
                      data-start-app-label={app.label}
                      onClick={() => {
                        handleLaunch(app);
                      }}
                    >
                      <AppGlyph icon={app.icon} label={app.label} size={16} />
                      <span>{app.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`start-menu-item start-menu-item--has-sub${startMenuActiveRoot === 'widget-layouts' ? ' start-menu-item--sim-open' : ''}`}
                onMouseEnter={() => emitStartMenuState({ open: true, activeRoot: 'widget-layouts' })}
              >
                <span className="start-menu-item-icon">📐</span>
                <span className="start-menu-item-label">Widget Layouts</span>
                <span className="start-menu-item-arrow">▶</span>
                <div className="start-menu-sub">
                  {orderedWidgetLayouts.map((layout) => {
                    const enabledWidgets = layout.items
                      .filter((item) => item.enabled)
                      .map((item) => widgetAppById.get(item.widgetId))
                      .filter((app): app is Application => !!app)

                    return (
                    <button
                      key={layout.id}
                      className="start-menu-sub-item"
                      onClick={() => { applyWidgetLayoutById(layout.id) }}
                      title={enabledWidgets.length > 0
                        ? `${layout.label}: ${enabledWidgets.map((app) => app.label).join(', ')}`
                        : layout.label}
                    >
                      <span style={{ width: 18, textAlign: 'center' }}>{layout.icon || '📐'}</span>
                      <span className="start-menu-sub-item-content">
                        <span className="start-menu-sub-item-title">{layout.label}</span>
                        <span className="start-menu-sub-item-meta">
                          {enabledWidgets.length > 0 ? enabledWidgets.map((app) => (
                            <span key={`${layout.id}-${app.id}`} className="start-menu-sub-item-badge">
                              <span className="start-menu-sub-item-badge-icon">{typeof app.icon === 'string' ? app.icon : '■'}</span>
                              <span>{app.label}</span>
                            </span>
                          )) : (
                            <span className="start-menu-sub-item-badge start-menu-sub-item-badge--muted">No enabled widgets</span>
                          )}
                        </span>
                      </span>
                    </button>
                  )})}
                  {systemWidgetLayouts.length > 0 && orderedWidgetLayouts.length > 0 && <div className="start-menu-separator" />}
                  {systemWidgetLayouts.length > 0 && (
                    <button
                      className="start-menu-sub-item"
                      onClick={() => { applyWidgetLayoutById(sourceCenterToggleRef.current) }}
                    >
                      <span style={{ width: 18, textAlign: 'center' }}>⇄</span>
                      <span className="start-menu-sub-item-content">
                        <span className="start-menu-sub-item-title">Toggle Source A/B</span>
                        <span className="start-menu-sub-item-meta">
                          <span className="start-menu-sub-item-badge start-menu-sub-item-badge--muted">Switch between the two source-center system layouts</span>
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="start-menu-separator" />

              <button
                className="start-menu-item"
                onClick={() => { socket.emit('scene:change', STATE.LOBBY); closeMenus() }}
              >
                <span className="start-menu-item-icon">🖥</span>
                <span className="start-menu-item-label">LOBBY</span>
              </button>

              <div className="start-menu-separator" />

              <button
                className="start-menu-item start-menu-item--danger"
                onClick={() => { socket.emit('panic'); closeMenus() }}
              >
                <span className="start-menu-item-icon">🔴</span>
                <span className="start-menu-item-label">PANIC</span>
              </button>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'desktop' ? (
              <>
                <button className="context-menu-item context-menu-item--disabled">Arrange Icons</button>
                <button className="context-menu-item" onClick={closeMenus}>Refresh</button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">New Folder</button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">Properties</button>
              </>
            ) : (
              <>
                <button
                  className={`context-menu-item context-menu-item--bold${iconMenuLaunchable ? '' : ' context-menu-item--disabled'}`}
                  onClick={() => { if (contextMenu.app && iconMenuLaunchable) handleLaunch(contextMenu.app) }}
                >
                  Open
                </button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">Create Shortcut</button>
                <button className="context-menu-item context-menu-item--disabled">Delete</button>
                <button className="context-menu-item context-menu-item--disabled">Rename</button>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item--disabled">Properties</button>
              </>
            )}
          </div>
        )}

        <DesktopNotifications />

        <Taskbar
          startMenuOpen={startMenuOpen}
          onStartClick={() => {
            const nextOpen = !startMenuOpen
            emitStartMenuState({ open: nextOpen, activeRoot: null })
            setContextMenu(null)
          }}
          onWidgetTaskbarClick={handleTaskbarWidgetClick}
        />

        {/* Screen saver — activates after idle timeout if enabled */}
        {ss && (
          <ScreenSaver
            enabled={ss.enabled}
            timeoutMinutes={ss.timeoutMinutes}
            preset={ss.preset}
          />
        )}

        {/* Widget windows — rendered above desktop content (z=50 within desktop stacking context) */}
        {visibleWidgets.map((a) => {
          const widgetComponent = getWidgetComponent(a)
          const WidgetComp = resolveWidgetComponent(a)
          const widgetProps: DesktopWidgetProps = {
            appId: a.id,
            defaultCameraLabel: widgetComponent === 'camera'
              ? (a.cameraSettings?.preferredDeviceLabel ?? '')
              : undefined,
            defaultMirror: widgetComponent === 'camera'
              ? (a.cameraSettings?.mirror ?? false)
              : undefined,
            onClose: () => {
              if ((window as any).__cursorMirrorVisualOnly) return
              if (simEmittingRef.current) socket.emit('widget:simulate:action', { widgetId: a.id, action: 'toggle' })
              else socket.emit('widget:toggle', a.id)
            },
            onMinimize: () => minimizeWidget(a.id),
            onFocus: () => focusWidget(a.id),
            windowState: closingWidgets.has(a.id) ? 'closing' : 'open',
            zIndex: getWidgetZIndex(a.id),
          }
          if (WidgetComp) return <WidgetComp key={a.id} {...widgetProps} />
          return <GenericWidget key={a.id} app={a} {...widgetProps} />
        })}
      </div>
    </CursorOverlayProvider>
  )
}
