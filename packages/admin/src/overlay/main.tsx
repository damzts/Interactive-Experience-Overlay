import ReactDOM from 'react-dom/client'
import '98.css'
import './overlay.css'
import App from './App'

// No StrictMode — double-mounting breaks singleton socket and GSAP timelines
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
