import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
      '/api': { target: 'https://localhost:3000', secure: false },
      '/socket.io': { target: 'https://localhost:3000', ws: true, secure: false },
      '/assets': { target: 'https://localhost:3000', secure: false },
      '/media': { target: 'https://localhost:3000', secure: false },
    },
  },
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'bus-trace': path.resolve(__dirname, 'bus-trace.html'),
      },
    },
  },
})
