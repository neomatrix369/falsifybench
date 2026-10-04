/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // public/score/index.html is a static report; only the app entry needs a dependency scan.
  optimizeDeps: { entries: ['index.html'] },
  // Dev only (npm run dev): /api goes to the local server. `vite build` ignores this, so the deployed site has no /api.
  server: { proxy: { '/api': `http://127.0.0.1:${process.env.FALSIFYBENCH_SERVER_PORT || 8787}` } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
