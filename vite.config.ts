/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Alle Assets (Schriften, Icons) werden mitgebaut und vom eigenen Server
// ausgeliefert. Keine fremden CDNs (Entscheidung E2).
//
// Die Komponentengalerie (galerie.html) ist nur im Test-Build enthalten
// (`vite build --mode test`, Entscheidung E24). Der Mode fuegt ausschliesslich
// diesen Einstieg hinzu; Plugins, Defines und alles Uebrige sind in beiden
// Builds gleich.
//
// Dev-Server (C-03): fest auf Port 5173, weil der Server im Dev-Profil genau
// die Origin http://localhost:5173 erlaubt (Origin-Prüfung, E15). `/v1` geht
// per Proxy an den Server auf Port 8080; so liegen App und API wie im Betrieb
// unter derselben Origin und das Sitzungs-Cookie funktioniert ohne CORS.
// `vite preview` übernimmt `server.proxy` und `server.strictPort`, wenn
// `preview` sie nicht selbst setzt. Die Preview-Server (auch die der
// Playwright-Tests) bleiben deshalb ausdrücklich ohne Proxy und mit dem
// bisherigen Standard für strictPort.
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': { target: 'http://localhost:8080' },
    },
  },
  preview: {
    strictPort: false,
    proxy: {},
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        ...(mode === 'test' ? { galerie: 'galerie.html' } : {}),
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
}));
