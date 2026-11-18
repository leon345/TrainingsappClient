import { defineConfig, devices } from '@playwright/test';

/**
 * Integrationstest gegen den ECHTEN Server (C-03, Teil 4). Läuft nicht im
 * normalen Lauf (eigene Konfiguration, eigener Ordner), nur über
 * `npm run test:e2e:integration`.
 *
 * Voraussetzung: Server im Dev-Modus auf http://localhost:8080
 * (`mvn quarkus:dev` im Server-Repo, siehe README "Prototyp lokal starten").
 * Den Client-Dev-Server (Port 5173, Proxy /v1 -> 8080) startet Playwright
 * selbst, falls er nicht schon läuft.
 */
export default defineConfig({
  testDir: './e2e-integration',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  projects: [
    {
      name: 'integration-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
