import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Rewrite /online/room/:roomCode and /online/overlay/:roomCode to their SPA entry points
    {
      name: 'online-spa-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/online\/room\/[A-Za-z0-9]+/.test(req.url)) {
            req.url = '/online-player.html'
          } else if (req.url && /^\/online\/overlay\/[A-Za-z0-9]+/.test(req.url)) {
            req.url = '/online-overlay.html'
          }
          next()
        })
      },
    },
  ],
  server: {
    port: 3001,
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
        main: resolve(__dirname, 'index.html'),
        'online-player': resolve(__dirname, 'online-player.html'),
        'online-overlay': resolve(__dirname, 'online-overlay.html'),
      },
    },
  },
})
