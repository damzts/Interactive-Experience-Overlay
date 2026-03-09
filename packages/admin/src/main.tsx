import ReactDOM from 'react-dom/client'

if (new URLSearchParams(window.location.search).get('livemode') === 'true') {
  // Render the bare overlay — no admin chrome, ready for OBS browser source
  Promise.all([
    import('98.css'),
    import('./overlay/overlay.css'),
    import('./overlay/App'),
  ]).then(([, , { default: OverlayApp }]) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(<OverlayApp />)
  })
} else {
  import('./admin.css').then(() =>
    import('./App').then(({ default: App }) => {
      ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
    })
  )
}
