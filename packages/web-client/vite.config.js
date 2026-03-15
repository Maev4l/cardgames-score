import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Proxy to CloudFront in dev (same as prod)
const apiEndpoint = 'https://atout.isnan.eu'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Atout',
        short_name: 'Atout',
        description: 'Track your card game scores - Belote, Tarot & more',
        theme_color: '#1a472a',
        background_color: '#1a472a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // iOS specific
        apple_touch_icon: '/apple-touch-icon.png',
        icons: [
          // Android Chrome icons
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          // Maskable icons for Android adaptive icons
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5176,
    proxy: {
      '/api': {
        target: apiEndpoint,
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
