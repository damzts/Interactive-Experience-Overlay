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

      {/* Idle overlay — floating terminal floaties (shimeji-like) */}
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
    </>
  )
}
