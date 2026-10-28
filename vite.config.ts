import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      id: '/', name: 'Lotto Pattern Lab', short_name: 'Lotto Lab',
      description: 'Historical Powerball and Mega Millions pattern analysis and backtesting.',
      start_url: '/', scope: '/', display: 'standalone',
      theme_color: '#0c1526', background_color: '#0c1526',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      cleanupOutdatedCaches: true,
      navigateFallback: '/index.html',
      // API responses are never cached here: only fully validated archives are persisted by the app.
    },
  })],
})
