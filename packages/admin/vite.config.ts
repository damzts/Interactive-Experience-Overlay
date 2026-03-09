import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'mpa-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // /overlay (no extension) → serve overlay.html
          if (req.url === '/overlay' || req.url?.startsWith('/overlay?')) {
            req.url = '/overlay.html'
            return next()
          }
          // /admin → redirect to root (admin lives at /)
          if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
            res.writeHead(302, { Location: '/' })
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
  server: {
    port: 3002,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/assets': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: resolve(__dirname, 'index.html'),
        overlay: resolve(__dirname, 'overlay.html'),
      },
    },
  },
})
