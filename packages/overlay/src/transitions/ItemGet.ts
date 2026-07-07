import gsap from 'gsap'
import type { ItemGetConfig } from '@ieomlabs/shared'

const RARITY_COLOR: Record<string, string> = {
  common: '#b9c2cf',
  rare: '#6fb4ff',
  epic: '#c96fff',
  legendary: '#ffd166',
}

/** ITEM-GET — Chrome Requiem. A forged server-announcement ticker slams
 *  across the bottom third: chrome bevel, rarity-colored name, no fade-in. */
export function runItemGet(cfg: ItemGetConfig) {
  const container = document.getElementById('tl-item-get')
  if (!container) return

  const rarity = cfg.rarity ?? 'rare'
  const rarityColor = RARITY_COLOR[rarity] ?? RARITY_COLOR.rare
  const name = cfg.itemName ?? 'Mystery Drop'
  const flavor = cfg.flavorText ?? ''
  const durationMs = cfg.durationMs ?? 3200

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    <div id="tl-item-get-bar" style="
      position:absolute; left:0; right:0; bottom:14%;
      transform:scaleX(0); transform-origin:50% 50%;
      background:linear-gradient(180deg,#4a4e58,#17181c);
      border-top:2px solid #b9c2cf; border-bottom:2px solid #17181c;
      box-shadow:0 -2px 0 rgba(255,255,255,0.15) inset, 0 8px 24px rgba(0,0,0,0.6);
      padding:10px 0; display:flex; align-items:center; justify-content:center; gap:16px;
    ">
      <span style="font-family:Audiowide,sans-serif; font-size:12px; letter-spacing:4px; color:#8a8f9c">ITEM GET</span>
      <span style="font-family:Audiowide,sans-serif; font-size:22px; letter-spacing:1px; color:${rarityColor}; text-shadow:0 0 12px ${rarityColor}">${name}</span>
      ${flavor ? `<span style="font-family:Share Tech Mono,monospace; font-size:13px; color:#c9ccd4">${flavor}</span>` : ''}
    </div>
  `
  const bar = container.querySelector('#tl-item-get-bar')

  gsap.timeline()
    .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.22, ease: 'power4.out' })
    .to(bar, { opacity: 0, duration: 0.35, ease: 'power2.in', delay: Math.max(durationMs / 1000 - 0.85, 0.4) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
