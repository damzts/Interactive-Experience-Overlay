import gsap from 'gsap'
import type { PodiumTakeConfig } from '@ieomlabs/shared'

const PLACE_LABEL: Record<number, string> = { 1: 'GOLD', 2: 'SILVER', 3: 'BRONZE' }
const PLACE_COLOR: Record<number, string> = { 1: '#f5d67a', 2: '#d8e6f2', 3: '#d99a5e' }

/** PODIUM-TAKE — Podium Chrome. A glass medal-ceremony card slides up from
 *  the bottom with gold/silver confetti chrome, held like an actual medal ceremony. */
export function runPodiumTake(cfg: PodiumTakeConfig) {
  const container = document.getElementById('tl-podium-take')
  if (!container) return

  const place = (cfg.place ?? 1) as 1 | 2 | 3
  const tint  = PLACE_COLOR[place] ?? PLACE_COLOR[1]
  const username = cfg.username ?? 'topGifter'
  const metric   = cfg.metric ?? ''
  const dur      = cfg.duration ?? 4

  const confetti = Array.from({ length: 18 }, (_, i) => {
    const x = (i / 18) * 100
    const delay = (i % 5) * 0.08
    const color = i % 2 === 0 ? tint : '#d8e6f2'
    return `<div class="tl-pt-shard" style="
      position:absolute; left:${x}%; top:-10%; width:6px; height:14px; background:${color};
      opacity:0; transform:rotate(${(i * 37) % 360}deg);
      box-shadow:0 0 6px ${color};
    " data-delay="${delay}"></div>`
  }).join('')

  gsap.set(container, { display: 'block' })
  container.innerHTML = `
    ${confetti}
    <div id="tl-pt-card" style="
      position:absolute; left:50%; bottom:12%; transform:translate(-50%,40%); opacity:0;
      background:radial-gradient(120% 140% at 30% 0%, #fff9e8, ${tint} 60%, #d8e6f2 100%);
      border-radius:18px; padding:20px 40px; text-align:center;
      box-shadow:0 8px 30px rgba(0,0,0,0.5), 0 3px 10px ${tint}66 inset;
    ">
      <div style="font-family:Electrolize,sans-serif; font-size:13px; letter-spacing:5px; color:#5a4a1e">${PLACE_LABEL[place] ?? 'GOLD'} PODIUM</div>
      <div style="font-family:Electrolize,sans-serif; font-size:28px; font-weight:bold; color:#2c2408; margin-top:4px">${username}</div>
      ${metric ? `<div style="font-family:Electrolize,sans-serif; font-size:15px; color:#5a4a1e; margin-top:4px">${metric}</div>` : ''}
    </div>
  `

  const card = container.querySelector('#tl-pt-card')
  const tl = gsap.timeline()
  tl.to(card, { transform: 'translate(-50%,0%)', opacity: 1, duration: 0.6, ease: 'back.out(1.4)' })

  container.querySelectorAll<HTMLElement>('.tl-pt-shard').forEach((shard) => {
    const delay = Number(shard.dataset.delay ?? 0)
    tl.to(shard, { top: '110%', opacity: 1, rotate: '+=180', duration: 1.6, ease: 'power1.in' }, delay)
    tl.to(shard, { opacity: 0, duration: 0.3 }, delay + 1.3)
  })

  tl.to(card, { opacity: 0, transform: 'translate(-50%,40%)', duration: 0.4, ease: 'power2.in', delay: Math.max(dur - 1.8, 0.6) })
    .call(() => { container.innerHTML = ''; gsap.set(container, { display: 'none' }) })
}
