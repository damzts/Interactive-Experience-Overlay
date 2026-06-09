/**
 * ThemeEngine — pure functions for building desktop CSS variable maps.
 * No React, no side-effects.
 */
import type { DesktopTheme } from '@ieomlabs/shared'
import type React from 'react'

const DEFAULT_ACCENT = '#7fd0ff'
const DEFAULT_TEXT = '#18314d'

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function adjustHexColor(input: string, delta: number) {
  const hex = input.replace('#', '')
  if (!/^[\da-fA-F]{6}$/.test(hex)) return input
  const r = clampChannel(parseInt(hex.slice(0, 2), 16) + delta)
  const g = clampChannel(parseInt(hex.slice(2, 4), 16) + delta)
  const b = clampChannel(parseInt(hex.slice(4, 6), 16) + delta)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function opaqueHexColor(input: string, fallback: string) {
  const value = input.trim()
  if (/^#[\da-fA-F]{3,4}$/.test(value)) {
    const expanded = value.slice(1).split('').map((c) => c + c).join('')
    return `#${expanded.slice(0, 6)}`
  }
  if (/^#[\da-fA-F]{6}([\da-fA-F]{2})?$/.test(value)) return `#${value.slice(1, 7)}`
  return fallback
}

function buildFontStack(fontFamily: string, fallback: string) {
  return `"${fontFamily.replace(/"/g, '\\"')}", ${fallback}`
}

export function buildDesktopThemeVars(
  theme: DesktopTheme,
  accentColor: string,
  textColor: string,
  fontFamily: string,
): React.CSSProperties {
  const customAccent = accentColor.startsWith('#') ? accentColor : '#2f70c8'
  const customText = textColor || '#ffffff'
  const opaqueCustomText = opaqueHexColor(customText, '#ffffff')
  const hasAccentOverride = theme === 'custom' || customAccent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase()
  const hasTextOverride = theme === 'custom' || customText.toLowerCase() !== DEFAULT_TEXT.toLowerCase()
  const hasFontOverride = fontFamily !== 'default'

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
      '--desktop-panel': '#ffe6fb', '--desktop-panel-light': '#ffffff', '--desktop-panel-dark': '#d76eb8',
      '--desktop-panel-shadow': '#772a72', '--desktop-title-start': '#ff7bc6', '--desktop-title-end': '#7bdcff',
      '--desktop-title-text': '#3d1140', '--desktop-ui-font': 'Trebuchet MS, Verdana, Arial, sans-serif',
      '--desktop-menu-hover': '#f05db3', '--desktop-menu-danger': '#bf4378',
      '--desktop-icon-shadow': '0 1px 2px rgba(65, 0, 70, 0.85)', '--desktop-tray-glow': 'rgba(255, 143, 216, 0.45)',
    })
  } else if (theme === 'frutiger aero') {
    Object.assign(vars, {
      '--desktop-panel': 'rgba(231, 247, 255, 0.92)', '--desktop-panel-light': '#ffffff', '--desktop-panel-dark': '#5b8fb8',
      '--desktop-panel-shadow': '#1f466f', '--desktop-title-start': '#2aa0e0', '--desktop-title-end': '#aef0ff',
      '--desktop-title-text': '#073c61', '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#1187d8', '--desktop-menu-danger': '#d24d4d',
      '--desktop-icon-shadow': '0 2px 6px rgba(0, 0, 0, 0.8)', '--desktop-tray-glow': 'rgba(55, 226, 255, 0.5)',
    })
  } else if (theme === 'midnight chrome') {
    Object.assign(vars, {
      '--desktop-panel': '#d8e2ef', '--desktop-panel-light': '#ffffff', '--desktop-panel-dark': '#667382',
      '--desktop-panel-shadow': '#0c1117', '--desktop-title-start': '#22384f', '--desktop-title-end': '#9ab8d8',
      '--desktop-title-text': '#f6fbff', '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#345c86', '--desktop-menu-danger': '#8c3849',
      '--desktop-icon-shadow': '0 2px 8px rgba(0, 0, 0, 0.9)', '--desktop-tray-glow': 'rgba(154, 184, 216, 0.4)',
    })
  } else if (theme === 'sunset boulevard') {
    Object.assign(vars, {
      '--desktop-panel': '#ffd8c8', '--desktop-panel-light': '#fff6f2', '--desktop-panel-dark': '#b96872',
      '--desktop-panel-shadow': '#4c1830', '--desktop-title-start': '#ff8b5f', '--desktop-title-end': '#ff5c8d',
      '--desktop-title-text': '#47101d', '--desktop-ui-font': 'Trebuchet MS, Verdana, Arial, sans-serif',
      '--desktop-menu-hover': '#d65475', '--desktop-menu-danger': '#8d2637',
      '--desktop-icon-shadow': '0 2px 6px rgba(48, 7, 18, 0.82)', '--desktop-tray-glow': 'rgba(255, 145, 109, 0.45)',
    })
  } else if (theme === 'coastal glass') {
    Object.assign(vars, {
      '--desktop-panel': 'rgba(229, 255, 252, 0.9)', '--desktop-panel-light': '#ffffff', '--desktop-panel-dark': '#65a1a6',
      '--desktop-panel-shadow': '#123f43', '--desktop-title-start': '#3ac6bf', '--desktop-title-end': '#b4fff8',
      '--desktop-title-text': '#0a4044', '--desktop-ui-font': 'Tahoma, Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': '#17989c', '--desktop-menu-danger': '#b44f4f',
      '--desktop-icon-shadow': '0 2px 6px rgba(0, 30, 32, 0.82)', '--desktop-tray-glow': 'rgba(148, 255, 244, 0.5)',
    })
  } else if (theme === 'amber terminal') {
    Object.assign(vars, {
      '--desktop-panel': '#d1a45b', '--desktop-panel-light': '#f6ddaf', '--desktop-panel-dark': '#74531f',
      '--desktop-panel-shadow': '#130d05', '--desktop-title-start': '#5b360d', '--desktop-title-end': '#be7c22',
      '--desktop-title-text': '#ffe0a0', '--desktop-ui-font': 'Lucida Console, Courier New, monospace',
      '--desktop-menu-hover': '#8e5d16', '--desktop-menu-danger': '#7a2d1d',
      '--desktop-icon-label': '#ffd77a', '--desktop-icon-shadow': '0 0 10px rgba(0, 0, 0, 0.9)',
      '--desktop-tray-glow': 'rgba(255, 186, 74, 0.45)',
    })
  } else if (theme === 'custom') {
    Object.assign(vars, {
      '--desktop-panel': adjustHexColor(customAccent, 110), '--desktop-panel-light': '#ffffff',
      '--desktop-panel-dark': adjustHexColor(customAccent, -35), '--desktop-panel-shadow': adjustHexColor(customAccent, -95),
      '--desktop-title-start': adjustHexColor(customAccent, -20), '--desktop-title-end': adjustHexColor(customAccent, 35),
      '--desktop-title-text': customText, '--desktop-ui-font': 'Segoe UI, Arial, sans-serif',
      '--desktop-menu-hover': adjustHexColor(customAccent, -25), '--desktop-menu-danger': '#9f2d41',
      '--desktop-icon-label': opaqueCustomText, '--desktop-tray-glow': `${customAccent}55`,
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
    vars['--desktop-ui-font'] = buildFontStack(fontFamily, vars['--desktop-ui-font']!)
  }

  return vars as React.CSSProperties
}
