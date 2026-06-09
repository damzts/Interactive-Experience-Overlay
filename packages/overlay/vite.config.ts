import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'vendor-three'
          }
          if (id.includes('node_modules/maplibre-gl')) {
            return 'vendor-maplibre'
          }
        },
      },
    },
  },
})
