import type { WidgetDefinition } from '../../contracts/widget.js'

export const spectrumAnalyzerDefinition = {
  id: 'spectrum-analyzer',
  componentType: 'spectrum-analyzer',
  defaultSize: { width: 300, height: 200 },
  zIndex: 10,
  system: false,
  label: 'Spectrum Analyzer',
  emits: [],
  accepts: [],
} as const satisfies WidgetDefinition
