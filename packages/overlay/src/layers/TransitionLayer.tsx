/** TransitionLayer — the DOM elements that GSAP transition functions animate.
 *  They all start invisible (opacity: 0 via CSS) and are shown by GSAP timelines. */
export function TransitionLayer() {
  return (
    <>
      {/* Boot screen — covers everything on first load, BootSequence.ts fades it out */}
      <div id="tl-boot-screen">
        <pre id="tl-boot-text" />
        <div id="tl-boot-bar">
          <div id="tl-boot-bar-fill" />
        </div>
      </div>

      {/* Win98 loading dialog (lobby-to-gameplay) */}
      <div id="tl-loading-window">
        <div className="window" style={{ width: 420, boxShadow: '4px 4px 0 #000' }}>
          <div className="title-bar">
            <div className="title-bar-text">Loading game…</div>
            <div className="title-bar-controls">
              <button aria-label="Minimize" />
              <button aria-label="Maximize" />
              <button aria-label="Close" />
            </div>
          </div>
          <div className="window-body" style={{ padding: 16 }}>
            <p style={{ marginBottom: 12, fontFamily: 'MS Sans Serif, Arial, sans-serif', fontSize: 13 }}>
              Please wait while the system initializes…
            </p>
            <div
              style={{
                width: '100%',
                height: 20,
                background: '#c0c0c0',
                border: '2px inset',
                overflow: 'hidden',
              }}
            >
              <div
                id="tl-progress-bar"
                style={{ width: '0%', height: '100%', background: '#000080' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen white flash (covers state change instant) */}
      <div id="tl-flash" />

      {/* TV static / noise (channel changes) */}
      <div id="tl-static-overlay" />

      {/* BSOD (reserved for future use) */}
      <div id="tl-bsod">
        <pre style={{ fontSize: 22, lineHeight: 1.6 }}>
          {`A problem has been detected and your stream has been shut down.\n\n` +
            `IRQL_NOT_LESS_OR_EQUAL\n\n` +
            `If this is the first time you have seen this Stop error screen,\n` +
            `restart your computer. If this screen appears again, follow\n` +
            `these steps:\n\n` +
            `Check to make sure any new hardware or software is properly installed.\n\n` +
            `*** STOP: 0x0000004E (0x00000099, 0x00000000, 0x00000000, 0x00000000)`}
        </pre>
      </div>

      {/* Death overlay */}
      <div id="tl-death-overlay">
        <div id="tl-death-text">YOU DIED</div>
      </div>

      {/* Victory overlay — Win98 dialog */}
      <div id="tl-victory-overlay" className="window" style={{ width: 380, position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, boxShadow: '4px 4px 0 #000' }}>
        <div className="title-bar">
          <div id="tl-victory-title" className="title-bar-text">MISSION.LOG — Write successful</div>
          <div className="title-bar-controls">
            <button aria-label="Close" />
          </div>
        </div>
        <div id="tl-victory-body" className="window-body" style={{ padding: 16 }}>
          <p style={{ fontFamily: 'MS Sans Serif, Arial, sans-serif', fontSize: 13, marginBottom: 8 }}>Session data saved to MISSION.LOG</p>
          <p style={{ fontFamily: 'MS Sans Serif, Arial, sans-serif', fontSize: 13, color: '#000080' }}>\u25ba VICTORY RECORDED</p>
        </div>
      </div>

      {/* Revive overlay — terminal boot sequence */}
      <div id="tl-revive-overlay" style={{ position: 'fixed', bottom: 80, left: 60, zIndex: 200, background: '#000', border: '1px solid #0f0', padding: '12px 20px', fontFamily: 'VT323, monospace', fontSize: 18, color: '#0f0', minWidth: 320 }}>
        <div id="tl-revive-line1" style={{ marginBottom: 8 }}>[ SYS ] Restarting process...</div>
        <div style={{ width: '100%', height: 10, background: '#111', border: '1px solid #0f0', overflow: 'hidden' }}>
          <div id="tl-revive-bar-fill" style={{ height: '100%', background: '#0f0', width: '0%' }} />
        </div>
        <div id="tl-revive-line2" style={{ marginTop: 8 }}>[ SYS ] Process restored</div>
      </div>

      {/* Network glitch overlay */}
      <div id="tl-glitch-overlay" style={{ position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
        <div id="tl-glitch-message" style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'VT323, monospace', fontSize: 32, color: '#f00', textShadow: '2px 0 #0ff, -2px 0 #f0f', letterSpacing: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>
          [ NETWORK INTERRUPTION ]<br />
          <span style={{ fontSize: 18, color: '#aaa', letterSpacing: 2 }}>[ MODEM ] reconnecting...</span>
        </div>
      </div>

      {/* Idle overlay — floating terminal floaties */}
      <div id="tl-idle-container" style={{ position: 'fixed', inset: 0, zIndex: 205, pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Sys message — terminal toast, repositioned per cfg */}
      <div id="tl-sysmsg-container" style={{ position: 'fixed', bottom: 60, left: 48, zIndex: 200, opacity: 0, fontFamily: 'VT323, monospace', fontSize: 20, color: '#0f0', textShadow: '0 0 6px #0f0', lineHeight: 1.4, pointerEvents: 'none', background: 'rgba(0,0,0,0.7)', border: '1px solid #0f04', padding: '10px 16px', minWidth: 280 }} />

      {/* Archive corruption — glitch rect container + scanline */}
      <div id="tl-corruption-overlay" style={{ position: 'fixed', inset: 0, zIndex: 215, pointerEvents: 'none', overflow: 'hidden' }} />
      <div id="tl-corruption-scanline" style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: 6, zIndex: 216, background: 'linear-gradient(180deg,rgba(255,255,255,0.6) 0%,rgba(0,255,200,0.3) 100%)', opacity: 0, pointerEvents: 'none', boxShadow: '0 0 12px rgba(0,255,200,0.8)' }} />

      {/* Notification box stack — flex column, appended dynamically, cascades top-left */}
      <div id="tl-notification-stack" style={{ position: 'fixed', top: 48, left: 48, zIndex: 220, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }} />

      {/* Vignette pulse — color vignette, optional text */}
      <div id="tl-vignette-overlay" style={{ position: 'fixed', inset: 0, zIndex: 195, opacity: 0, pointerEvents: 'none' }} />

      {/* Typewriter — text appears at configured position */}
      <div id="tl-typewriter-container" style={{ position: 'fixed', inset: 0, zIndex: 210, pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Media overlay container — image/video sources (ImageOverlay.ts, VideoOverlay.ts) */}
      <div id="tl-media-container" style={{ position: 'fixed', inset: 0, zIndex: 218, pointerEvents: 'none', overflow: 'hidden' }} />

      {/* ── New effect containers ─────────────────────────────────── */}

      {/* Achievement unlock — Xbox 360 style toast, bottom-right */}
      <div id="tl-achievement-unlock" style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 210, display: 'none', pointerEvents: 'none' }} />

      {/* Friend join — Xbox Live / Messenger, offset above achievement */}
      <div id="tl-friend-join" style={{ position: 'fixed', bottom: 120, right: 32, zIndex: 210, display: 'none', pointerEvents: 'none' }} />

      {/* System alert — Vista UAC center dialog */}
      <div id="tl-system-alert" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 215, display: 'none', pointerEvents: 'none' }} />

      {/* Error dialog — Win98 error box */}
      <div id="tl-error-dialog" style={{ position: 'fixed', top: '45%', left: '55%', transform: 'translate(-50%,-50%)', zIndex: 215, display: 'none', pointerEvents: 'none' }} />

      {/* VHS glitch — full-screen RGB displacement */}
      <div id="tl-vhs-glitch" style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Scan lines sweep — full-screen CRT scanline */}
      <div id="tl-scan-lines" style={{ position: 'fixed', inset: 0, zIndex: 201, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Neon glow — screen border pulse */}
      <div id="tl-neon-glow" style={{ position: 'fixed', inset: 0, zIndex: 195, pointerEvents: 'none', display: 'none' }} />

      {/* Chromatic aberration — RGB channel offset clones */}
      <div id="tl-chromatic" style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Film burn — warm overexposure from corner */}
      <div id="tl-film-burn" style={{ position: 'fixed', inset: 0, zIndex: 196, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* TV off — CRT power-down collapse */}
      <div id="tl-tv-off" style={{ position: 'fixed', inset: 0, zIndex: 220, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Pixel transition — grid of colored tiles scatter/reform */}
      <div id="tl-pixel-grid" style={{ position: 'fixed', inset: 0, zIndex: 218, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Dial-up connect — modem handshake terminal window */}
      <div id="tl-dialup" style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 215, display: 'none', pointerEvents: 'none' }} />

      {/* Confetti burst — full-screen particle rain */}
      <div id="tl-confetti" style={{ position: 'fixed', inset: 0, zIndex: 205, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* XP gain — floating text bubbles */}
      <div id="tl-xp-gain" style={{ position: 'fixed', inset: 0, zIndex: 210, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Fireworks — star particle bursts */}
      <div id="tl-fireworks" style={{ position: 'fixed', inset: 0, zIndex: 205, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* DVD bounce — text bounces around screen */}
      <div id="tl-dvd-bounce" style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Level up — zoom text + ring shockwave */}
      <div id="tl-level-up" style={{ position: 'fixed', inset: 0, zIndex: 215, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* ── Colorful particles & light containers ──────────────── */}

      {/* Aurora wave — flowing aurora ribbons */}
      <div id="tl-aurora-wave" style={{ position: 'fixed', inset: 0, zIndex: 198, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Starfall — shooting stars with glowing trails */}
      <div id="tl-starfall" style={{ position: 'fixed', inset: 0, zIndex: 205, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Bubble pop — glossy bubbles rise and pop */}
      <div id="tl-bubble-pop" style={{ position: 'fixed', inset: 0, zIndex: 205, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Glitter bomb — twinkling glitter explosion */}
      <div id="tl-glitter-bomb" style={{ position: 'fixed', inset: 0, zIndex: 208, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Laser sweep — synthwave beams cross the screen */}
      <div id="tl-laser-sweep" style={{ position: 'fixed', inset: 0, zIndex: 202, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* ── Stream personality containers ─────────────────────── */}

      {/* Cinema moment — letterbox bars + vignette + dramatic text */}
      <div id="tl-cinema-moment" style={{ position: 'fixed', inset: 0, zIndex: 220, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Chapter reveal — full-screen title card */}
      <div id="tl-chapter-reveal" style={{ position: 'fixed', inset: 0, zIndex: 222, pointerEvents: 'none', display: 'none' }} />

      {/* Clip that — corner badge */}
      <div id="tl-clip-that" style={{ position: 'fixed', top: 32, right: 32, zIndex: 230, pointerEvents: 'none', display: 'none' }} />

      {/* Persona shift — full-screen color wash + text */}
      <div id="tl-persona-shift" style={{ position: 'fixed', inset: 0, zIndex: 225, pointerEvents: 'none', display: 'none' }} />

      {/* Moment marker — corner stamp */}
      <div id="tl-moment-marker" style={{ position: 'fixed', bottom: 32, left: 32, zIndex: 212, pointerEvents: 'none', display: 'none' }} />

      {/* Crowd roar — shake + vignette + text (reuses overlay-root + containers) */}
      <div id="tl-crowd-roar" style={{ position: 'fixed', inset: 0, zIndex: 220, pointerEvents: 'none', display: 'none' }} />

      {/* Intermission — full BRB card */}
      <div id="tl-intermission" style={{ position: 'fixed', inset: 0, zIndex: 230, pointerEvents: 'none', display: 'none' }} />

      {/* Shockwave — expanding ring */}
      <div id="tl-shockwave" style={{ position: 'fixed', inset: 0, zIndex: 205, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* Hype pulse — rainbow border */}
      <div id="tl-hype-pulse" style={{ position: 'fixed', inset: 0, zIndex: 195, pointerEvents: 'none', display: 'none' }} />

      {/* Countdown burst — 3-2-1 full-screen */}
      <div id="tl-countdown-burst" style={{ position: 'fixed', inset: 0, zIndex: 225, pointerEvents: 'none', display: 'none' }} />

      {/* Spotlight — dark radial mask with bright circle */}
      <div id="tl-spotlight" style={{ position: 'fixed', inset: 0, zIndex: 215, pointerEvents: 'none', display: 'none' }} />

      {/* Chat bubble — pinned speech bubble */}
      <div id="tl-chat-bubble" style={{ position: 'fixed', inset: 0, zIndex: 212, pointerEvents: 'none', display: 'none', overflow: 'hidden' }} />

      {/* ── 2000s Internet Nostalgia ──────────────────────────── */}

      {/* AIM message — AOL Instant Messenger window, bottom-right */}
      <div id="tl-aim-message" style={{ position: 'fixed', bottom: 80, right: 32, zIndex: 220, display: 'none', pointerEvents: 'none' }} />

      {/* MSN nudge — balloon + shake, bottom-right */}
      <div id="tl-msn-nudge" style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 221, display: 'none', pointerEvents: 'none' }} />

      {/* XP balloon — system tray notification, very bottom-right */}
      <div id="tl-xp-balloon" style={{ position: 'fixed', bottom: 56, right: 48, zIndex: 222, display: 'none', pointerEvents: 'none' }} />

      {/* Geocities alert — JS alert() centered on screen */}
      <div id="tl-geocities-alert" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 230, display: 'none', pointerEvents: 'none' }} />

      {/* Buffering — early YouTube full-screen overlay */}
      <div id="tl-buffering" style={{ position: 'fixed', inset: 0, zIndex: 225, display: 'none', pointerEvents: 'none' }} />

      {/* Winamp skip — media player widget, top-right */}
      <div id="tl-winamp-skip" style={{ position: 'fixed', top: 32, right: 32, zIndex: 218, display: 'none', pointerEvents: 'none' }} />

      {/* Email alert — Hotmail/AOL card, bottom-right */}
      <div id="tl-email-alert" style={{ position: 'fixed', bottom: 32, right: 140, zIndex: 219, display: 'none', pointerEvents: 'none' }} />

      {/* ── Anime effects ──────────────────────────────────────── */}

      {/* Speed lines — canvas radial lines, full-screen */}
      <div id="tl-speed-lines" style={{ position: 'fixed', inset: 0, zIndex: 215, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Impact frame — flash + ink lines + bold text, full-screen */}
      <div id="tl-impact-frame" style={{ position: 'fixed', inset: 0, zIndex: 228, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Power-up aura — expanding rings + glow column, full-screen */}
      <div id="tl-power-up-aura" style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* To Be Continued — sepia wash + slide text, full-screen */}
      <div id="tl-to-be-continued" style={{ position: 'fixed', inset: 0, zIndex: 226, display: 'none', pointerEvents: 'none' }} />

      {/* Screentone wipe — halftone dot pattern wipe, full-screen */}
      <div id="tl-screentone-wipe" style={{ position: 'fixed', inset: 0, zIndex: 224, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Sweat drop — anime teardrop shape, top-right corner */}
      <div id="tl-sweat-drop" style={{ position: 'fixed', top: 0, right: 80, zIndex: 223, display: 'none', pointerEvents: 'none' }} />

      {/* Dramatic zoom — full-screen scale container */}
      <div id="tl-dramatic-zoom" style={{ position: 'fixed', inset: 0, zIndex: 216, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* ── MMORPG / Retro-Futurist ────────────────────────────── */}

      {/* Item pickup — loot burst + name banner, center */}
      <div id="tl-item-pickup" style={{ position: 'fixed', inset: 0, zIndex: 219, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Quest complete — banner slides from top */}
      <div id="tl-quest-complete" style={{ position: 'fixed', inset: 0, zIndex: 227, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Critical hit — flash + impact text, full-screen */}
      <div id="tl-critical-hit" style={{ position: 'fixed', inset: 0, zIndex: 229, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Boss warning — Metal Gear "!" alert, full-screen */}
      <div id="tl-boss-warning" style={{ position: 'fixed', inset: 0, zIndex: 231, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Combo multiplier — fighting-game combo counter, center */}
      <div id="tl-combo-multiplier" style={{ position: 'fixed', inset: 0, zIndex: 219, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Game over — retro pixel wipe, full-screen */}
      <div id="tl-game-over" style={{ position: 'fixed', inset: 0, zIndex: 232, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Matrix glitch — matrix-rain dissolve, full-screen */}
      <div id="tl-matrix-glitch" style={{ position: 'fixed', inset: 0, zIndex: 233, display: 'none', pointerEvents: 'none', overflow: 'hidden', opacity: 0 }} />

      {/* ── Aesthetic Cartridges ───────────────────────────────── */}

      {/* Halo charge — Aero Saint spinning ring + white-out bloom, full-screen */}
      <div id="tl-halo-charge" style={{ position: 'fixed', inset: 0, zIndex: 217, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Item get — Chrome Requiem loot ticker, bottom-third band */}
      <div id="tl-item-get" style={{ position: 'fixed', inset: 0, zIndex: 219, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Sick trick — Trick City spray-streak wipe + combo callout, full-screen */}
      <div id="tl-sick-trick" style={{ position: 'fixed', inset: 0, zIndex: 219, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Save point chime — Save Point JRPG level-up card, full-screen */}
      <div id="tl-save-point-chime" style={{ position: 'fixed', inset: 0, zIndex: 227, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Sign-on ping — Dial Tone Dream buddy-list card, bottom-right */}
      <div id="tl-sign-on-ping" style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 220, display: 'none', pointerEvents: 'none' }} />

      {/* Next episode — Signal Ghost VHS bumper title card, full-screen */}
      <div id="tl-next-episode" style={{ position: 'fixed', inset: 0, zIndex: 234, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />

      {/* Podium take — Podium Chrome medal-ceremony card + confetti chrome, full-screen */}
      <div id="tl-podium-take" style={{ position: 'fixed', inset: 0, zIndex: 219, display: 'none', pointerEvents: 'none', overflow: 'hidden' }} />
    </>
  )
}
