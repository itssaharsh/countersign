import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5199,
    proxy: {
      '/api': { target: 'http://localhost:8790', changeOrigin: true },
    },
  },
  // The same proxy for `vite preview`, which serves the production bundle.
  // Vite keeps server.proxy and preview.proxy separate, so a preview without
  // this answers 404 on /api and the console reports the engine as offline.
  // The review tools scan the preview rather than the dev server: dev serves
  // three.js as several hundred separate module requests and the page never
  // reaches network idle, which reads as a navigation timeout rather than as
  // what it is.
  preview: {
    port: 5200,
    proxy: {
      '/api': { target: 'http://localhost:8790', changeOrigin: true },
    },
  },
})
