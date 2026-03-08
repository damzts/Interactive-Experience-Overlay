/** TransitionLayer — the DOM elements that GSAP transition functions animate.
 *  They all start invisible (opacity: 0 via CSS) and are shown by GSAP timelines. */
export function TransitionLayer() {
  return (
    <>
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
    </>
  )
}
