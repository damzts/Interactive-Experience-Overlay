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
      '/api/auth': { target: 'https://ieom.danhub.dev', changeOrigin: true },
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/assets': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
