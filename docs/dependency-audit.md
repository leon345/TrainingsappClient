# Dependency-Audit (Client)

Stand: 19.11.2026 (`GC-05`)

## Produktions-Abhängigkeiten (`npm audit --omit=dev`)

```bash
npm audit --omit=dev
```

- **Ergebnis:** `found 0 vulnerabilities` (Exit-Code `0`)
- **Hohe / Kritische Befunde:** `0`
- **Moderate / Niedrige Befunde:** `0`

Alle in das Produktions-Bundle (`dist/`) aufgenommenen Abhängigkeiten (`react`, `react-dom`, `react-router`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@material/material-color-utilities`, `@fontsource-variable/roboto`, `openapi-fetch`) sind frei von bekannten Sicherheitslücken.

## Entwicklungs-Abhängigkeiten (`npm audit`)

```bash
npm audit
```

- **Ergebnis:** 4 moderate Befunde (0 hoch, 0 kritisch), ausschließlich in Dev-Build-Werkzeugen:
  - `glob` (`9.0.0 - 14.0.1`, moderate, `GHSA-3g3m-2fjr-6pw4`) und transitiv `minimatch` (`7.0.0 - 11.0.0`, moderate, `GHSA-g3hv-75wg-m249`), eingebunden über `vite-plugin-pwa` -> `workbox-build`.
- **Bewertung:** Kein Einfluss auf die Laufzeit im Browser oder das Produktions-Bundle (`dist/`). Kein automatisches `npm audit fix --force`, da dies ein Breaking-Downgrade auf `vite-plugin-pwa@1.1.0` erzwingen würde. Nachfolgerversion von `workbox-build` / `vite-plugin-pwa` wird regulär bei Abhängigkeits-Updates übernommen.
