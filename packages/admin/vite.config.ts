import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const blockUnknownRoutes = {
  name: 'block-unknown-routes',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/overlay')) {
        res.writeHead(404)
        res.end()
        return
      }
      next()
    })
  },
}

export default defineConfig({
  envDir: '../..',
  plugins: [react(), tailwindcss(), blockUnknownRoutes],
  server: {
    port: 3002,
    proxy: {
      '/api/auth': { target: 'http://localhost:3100', changeOrigin: true },
      '/api': 'http://localhost:3100',
      '/socket.io': { target: 'http://localhost:3100', ws: true },
      '/assets': 'http://localhost:3100',
      '/media': 'http://localhost:3100',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
