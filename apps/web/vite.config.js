import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The Master backend (backend/server.js) owns /api; proxy it in dev so
    // the app works identically under `vite dev` and when served built.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tools/vacation/test/setup.js',
    globals: true,
  },
})
