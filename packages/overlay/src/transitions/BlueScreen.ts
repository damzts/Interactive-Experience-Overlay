import gsap from 'gsap'
import type { BlueScreenConfig } from '@ieomlabs/shared'

const DEFAULT_MSG  = 'A fatal exception has occurred in the broadcast stream.\nThe current stream state will be terminated.'
const DEFAULT_CODE = '0x0000001E'

/** BLUE-SCREEN — BSOD flash with scrolling error text. */
export function runBlueScreen(cfg: BlueScreenConfig) {
  const container = document.getElementById('tl-bsod')
  if (!container) return

  const code = cfg.errorCode ?? DEFAULT_CODE
  const msg  = (cfg.message  ?? DEFAULT_MSG).replace(/\n/g, '\n')

  const pre = container.querySelector('pre')
  if (pre) {
    pre.textContent = [
      'A problem has been detected and your stream has been shut down.\n',
      `${msg}\n`,
      "If this is the first time you've seen this Stop error screen, restart the stream.\n",
      `\n*** STOP: ${code} (0x00000000, 0x00000000, 0x00000000, 0x00000000)\n`,
    ].join('\n')
  }

  const fade = 0.1
  const hold = cfg.duration - fade * 2

  gsap.timeline()
    .set(container, { display: 'block', opacity: 0 })
    .to(container, { opacity: 1, duration: fade })
    .to(container, { opacity: 0, duration: fade, delay: hold })
    .call(() => gsap.set(container, { display: 'none' }))
}
