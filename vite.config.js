import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from phones on the LAN during development
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Charts and date pickers are the heavy half; caching them separately
        // keeps app updates small over the LAN.
        manualChunks: {
          charts: ['@mui/x-charts'],
          pickers: ['@mui/x-date-pickers', 'dayjs'],
        },
      },
    },
  },
})
