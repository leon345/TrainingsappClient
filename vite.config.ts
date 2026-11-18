/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Alle Assets (Schriften, Icons) werden mitgebaut und vom eigenen Server
// ausgeliefert. Keine fremden CDNs (Entscheidung E2).
export default defineConfig({
  build: {
    rollupOptions: {
      // Zweite Einstiegsseite: Komponentengalerie fuer visuelle Tests (C-06).
      input: {
        main: 'index.html',
        galerie: 'galerie.html',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: '/',
        name: 'Trainingsapp',
        short_name: 'Training',
        description: 'Intervalltimer und Workout-Tracking',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // Werte aus src/theme/tokens/farbe.css (hell): surface und surface-container.
        background_color: '#fdf7fe',
        theme_color: '#f2ecf5',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    server: {
      deps: {
        // Das Paket importiert intern teils ohne Dateiendung (z. B.
        // '../dynamiccolor/dynamic_scheme'). Node löst das als ESM nicht auf,
        // Vite schon. Deshalb lässt Vitest es durch Vite laufen.
        inline: ['@material/material-color-utilities'],
      },
    },
  },
});
