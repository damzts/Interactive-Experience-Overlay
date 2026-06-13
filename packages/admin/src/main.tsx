import ReactDOM from 'react-dom/client'
import './admin.css'

// If this is the OAuth callback popup, render only the minimal callback handler
// instead of the full app. This prevents the popup from loading the entire dashboard.
if (window.location.pathname === '/auth/callback') {
  import('./auth/OAuthCallback').then(({ OAuthCallback }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(<OAuthCallback />)
  })
} else {
  import('./App').then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
  })
}
