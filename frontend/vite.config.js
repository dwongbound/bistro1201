import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'globalThis.__APP_CONFIG__': JSON.stringify({
      apiUrl: process.env.APP_API_BASE_PATH || '/api',
      instance: process.env.APP_INSTANCE || 'dev',
    }),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.DEV_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
