import { useEffect, useRef, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'

interface Props {
  onClose: () => void
  onMinimize?: () => void
  onFocus?: () => void
  windowState?: 'open' | 'closing'
  zIndex?: number
}

const SOURCE_WIDTH = 512
const SOURCE_HEIGHT = 192
const DISPLAY_COLS = 128
const DISPLAY_ROWS = 48
const CELL_SIZE = 4
const SCENE_LENGTH = 180

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function drawGlowLine(ctx: CanvasRenderingContext2D, y: number, tick: number, amplitude: number, frequency: number) {
  ctx.beginPath()
  for (let x = 0; x <= SOURCE_WIDTH; x += 2) {
    const waveY = y + Math.sin((x + tick * 7) / frequency) * amplitude
    if (x === 0) ctx.moveTo(x, waveY)
    else ctx.lineTo(x, waveY)
  }
  ctx.stroke()
}

function drawBubbleColumn(ctx: CanvasRenderingContext2D, x: number, tick: number, offset: number) {
  ctx.strokeStyle = 'rgba(150, 255, 255, 0.9)'
  ctx.lineWidth = 2
  for (let index = 0; index < 6; index += 1) {
    const progress = (tick * 5 + index * 34 + offset) % (SOURCE_HEIGHT + 36)
    const y = SOURCE_HEIGHT - progress
    const drift = Math.sin((tick + index * 3) / 6) * 5
    ctx.beginPath()
    ctx.arc(x + drift, y, 2 + (index % 2), 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawSparkStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath()
  ctx.moveTo(x - size, y)
  ctx.lineTo(x + size, y)
  ctx.moveTo(x, y - size)
  ctx.lineTo(x, y + size)
  ctx.stroke()
}

function drawDolphinShape(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, phase: number, flip = false) {
  const direction = flip ? -1 : 1
  const bob = Math.sin(phase) * 4

  ctx.save()
  ctx.translate(x, y + bob)
  ctx.scale(direction * scale, scale)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(14, -12, 34, -9)
  ctx.quadraticCurveTo(48, -5, 60, -14)
  ctx.quadraticCurveTo(55, -6, 57, 3)
  ctx.quadraticCurveTo(66, 4, 73, -2)
  ctx.quadraticCurveTo(67, 7, 56, 8)
  ctx.quadraticCurveTo(47, 15, 30, 14)
  ctx.quadraticCurveTo(17, 13, 7, 8)
  ctx.quadraticCurveTo(1, 13, -10, 17)
  ctx.quadraticCurveTo(-2, 9, 0, 0)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(28, -2)
  ctx.quadraticCurveTo(31, -17, 41, -22)
  ctx.quadraticCurveTo(37, -8, 31, -1)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.arc(49, -2, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDolphinsSource(ctx: CanvasRenderingContext2D, tick: number) {
  const cycle = tick % SCENE_LENGTH
  let zoom = 1.02
  let panX = 0
  let panY = 0

  if (cycle < 42) {
    const progress = cycle / 42
    zoom = lerp(1.02, 1.12, progress)
    panX = lerp(18, -96, progress)
    panY = lerp(0, -4, progress)
  } else if (cycle < 96) {
    const progress = (cycle - 42) / 54
    zoom = lerp(1.12, 1.62, progress)
    panX = lerp(-96, -152, progress)
    panY = lerp(-4, -26, progress)
  } else if (cycle < 138) {
    const progress = (cycle - 96) / 42
    zoom = lerp(1.62, 1.78, progress)
    panX = lerp(-138, -188, progress)
    panY = lerp(-26, -34, progress)
  } else {
    const progress = (cycle - 138) / 42
    zoom = lerp(1.78, 1.16, progress)
    panX = lerp(-188, -78, progress)
    panY = lerp(-34, -8, progress)
  }

  ctx.fillStyle = '#05090b'
  fillRect(ctx, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)

  ctx.save()
  ctx.translate(panX, panY)
  ctx.scale(zoom, zoom)

  const sky = ctx.createLinearGradient(0, 0, 0, 88)
  sky.addColorStop(0, '#071117')
  sky.addColorStop(1, '#061018')
  ctx.fillStyle = sky
  fillRect(ctx, 0, 0, SOURCE_WIDTH, 88)

  const water = ctx.createLinearGradient(0, 92, 0, SOURCE_HEIGHT)
  water.addColorStop(0, '#0c2230')
  water.addColorStop(1, '#05090b')
  ctx.fillStyle = water
  fillRect(ctx, 0, 92, SOURCE_WIDTH, SOURCE_HEIGHT - 92)

  ctx.strokeStyle = '#7ef7ff'
  ctx.lineWidth = 2.5
  drawGlowLine(ctx, 118, tick, 8, 32)
  drawGlowLine(ctx, 132, tick + 3, 6, 22)
  drawGlowLine(ctx, 146, tick + 6, 4, 16)

  drawBubbleColumn(ctx, 54, tick, 0)
  drawBubbleColumn(ctx, 178, tick, 26)
  drawBubbleColumn(ctx, 410, tick, 54)

  ctx.fillStyle = '#8affff'
  drawDolphinShape(ctx, 106 + Math.sin(tick / 6) * 16, 88, 1.85, tick / 4, false)
  ctx.fillStyle = '#5edbff'
  drawDolphinShape(ctx, 286 + Math.cos(tick / 7) * 18, 68, 1.62, tick / 4 + 1.7, true)
  ctx.fillStyle = '#76efff'
  drawDolphinShape(ctx, 404 + Math.sin(tick / 5) * 12, 108, 1.18, tick / 4 + 0.9, false)

  ctx.strokeStyle = '#9ffcff'
  ctx.lineWidth = 2
  drawSparkStar(ctx, 62 + (tick % 5), 26, 4)
  drawSparkStar(ctx, 172 + (tick % 6), 18, 3)
  drawSparkStar(ctx, 354 - (tick % 5), 32, 4)
  drawSparkStar(ctx, 452 - (tick % 4), 20, 3)
  ctx.restore()
}

function renderSourceScene(canvas: HTMLCanvasElement, tick: number) {
  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)
  drawDolphinsSource(context, tick)
}

function renderLCD(sourceCanvas: HTMLCanvasElement, displayCanvas: HTMLCanvasElement) {
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const displayContext = displayCanvas.getContext('2d')
  if (!sourceContext || !displayContext) return

  const imageData = sourceContext.getImageData(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT).data
  displayContext.fillStyle = '#020508'
  displayContext.fillRect(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT)

  for (let row = 0; row < DISPLAY_ROWS; row += 1) {
    for (let col = 0; col < DISPLAY_COLS; col += 1) {
      let brightness = 0
      for (let sampleY = 0; sampleY < CELL_SIZE; sampleY += 1) {
        for (let sampleX = 0; sampleX < CELL_SIZE; sampleX += 1) {
          const x = col * CELL_SIZE + sampleX
          const y = row * CELL_SIZE + sampleY
          const index = (y * SOURCE_WIDTH + x) * 4
          brightness += (imageData[index] * 0.2126) + (imageData[index + 1] * 0.7152) + (imageData[index + 2] * 0.0722)
        }
      }

      const normalized = brightness / (CELL_SIZE * CELL_SIZE * 255)
      if (normalized < 0.09) continue

      const level = normalized > 0.9 ? 1 : normalized > 0.74 ? 0.86 : normalized > 0.58 ? 0.68 : normalized > 0.4 ? 0.5 : normalized > 0.22 ? 0.32 : 0.2
      const teal = `rgba(${Math.round(14 + 34 * level)}, ${Math.round(128 + 112 * level)}, ${Math.round(182 + 68 * level)}, ${0.2 + level * 0.76})`
      displayContext.fillStyle = teal
      fillRect(displayContext, col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1)
    }
  }
}

export function LCDDolphinsWidget({ onClose, onMinimize, onFocus, windowState = 'open', zIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = SOURCE_WIDTH
    sourceCanvas.height = SOURCE_HEIGHT
    sourceCanvasRef.current = sourceCanvas
    return () => {
      sourceCanvasRef.current = null
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((current) => current + 1)
    }, 80)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !sourceCanvasRef.current) return
    renderSourceScene(sourceCanvasRef.current, tick)
    renderLCD(sourceCanvasRef.current, canvasRef.current)
  }, [tick])

  return (
    <DesktopWindow
      id="lcd-dolphins"
      title="Pioneer LCD Sim"
      width={320}
      height={240}
      defaultPosition={{ x: 540, y: 220 }}
      zIndex={zIndex}
      state={windowState}
      windowClassName="desktop-window--lcd-dolphins"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
      bodyStyle={{ padding: '12px' }}
    >
      <div className="widget-stack widget-stack--fill">
        <div className="widget-panel widget-panel--display widget-panel--lcd-dolphins">
          <div className="widget-lcd-shell">
            <div className="widget-lcd-screen" aria-label="Animated Pioneer-style LCD pixel display">
              <canvas
                ref={canvasRef}
                className="widget-lcd-canvas"
                width={SOURCE_WIDTH}
                height={SOURCE_HEIGHT}
              />
              <span className="widget-lcd-reflection" />
            </div>
          </div>
        </div>
      </div>
    </DesktopWindow>
  )
}