import gsap from 'gsap'
import type { ItemPickupConfig } from '@ieomlabs/shared'

const RARITY_COLORS: Record<string, string> = {
  common:    '#c0c0c0',
  rare:      '#4d96ff',
  epic:      '#c586ff',
  legendary: '#ffb02e',
}

/** ITEM-PICKUP — MMORPG loot explosion with rarity-colored burst + item name banner. */
export function runItemPickup(cfg: ItemPickupConfig) {
  const container = document.getElementById('tl-item-pickup')
  if (!container) return

  const rarity = cfg.rarity ?? 'rare'
  const color  = RARITY_COLORS[rarity] ?? RARITY_COLORS.rare
  const name   = cfg.itemName ?? 'Mystery Item'
  const durMs  = cfg.durationMs ?? 2600

  gsap.set(container, { display: 'block' })
  container.innerHTML = ''

  const burst = document.createElement('div')
  burst.style.cssText = [
    'position:absolute', 'left:50%', 'top:50%',
    'width:120px', 'height:120px', 'border-radius:50%',
    `background:radial-gradient(circle, ${color}cc 0%, ${color}00 70%)`,
    'transform:translate(-50%,-50%) scale(0)',
  ].join(';')
  container.appendChild(burst)

  for (let i = 0; i < 12; i++) {
    const shard = document.createElement('div')
    const angle = (i / 12) * Math.PI * 2
    shard.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%',
      'width:6px', 'height:6px', `background:${color}`,
      `box-shadow:0 0 8px ${color}`,
      'transform:translate(-50%,-50%)',
    ].join(';')
    container.appendChild(shard)
    gsap.to(shard, {
      x: Math.cos(angle) * 160, y: Math.sin(angle) * 160, opacity: 0,
      duration: 0.8, ease: 'power2.out',
    })
  }

  const label = document.createElement('div')
  label.style.cssText = [
    'position:absolute', 'left:50%', 'top:60%',
    'transform:translate(-50%,0) scale(0)',
    'font-family:VT323,monospace', 'font-size:34px', 'white-space:nowrap',
    `color:${color}`, `text-shadow:0 0 20px ${color}`, 'letter-spacing:2px',
  ].join(';')
  label.textContent = `+ ${name}`
  container.appendChild(label)

  gsap.timeline()
    .to(burst, { scale: 1, opacity: 0, duration: 0.6, ease: 'power2.out' })
    .to(label, { scale: 1, duration: 0.35, ease: 'back.out(2)' }, 0.15)
    .to(label, { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in', delay: Math.max((durMs - 1000) / 1000, 0.4) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
