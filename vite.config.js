import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true
      },
      // INCLUIMOS EL ICONO SVG
      includeAssets: ['favicon.ico', 'icon.svg'],
      manifest: {
        name: 'Sentinel Shift',
        short_name: 'Sentinel',
        description: 'Gestor de Cuadrantes de Seguridad',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512', // El SVG vale para todos los tamaños
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['turnos.dking.es', 'amp.dking.es', 'all'] 
  }
})