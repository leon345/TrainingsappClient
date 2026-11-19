# TrainingsappClient

Frontend der Trainingsapp (Intervalltimer und Workout-Tracking) als Progressive Web App (PWA). Das zugehoerige Backend liegt in [TrainingsappServer](https://github.com/leon345/TrainingsappServer).

Status: Grundgeruest und Material-3-Expressive-Design-System umgesetzt (`GC-01`).

## Technologie-Stack

- **Basis:** React 19, TypeScript (strict), Vite, PWA (`vite-plugin-pwa` / Workbox)
- **Design-System:** `@mui/material` mit Material-3-Expressive-Theme (Farbpaletten aus `@material/material-color-utilities`, selbst gehostete Schrift via `@fontsource-variable/roboto`, lokale Icons via `@mui/icons-material` – keine fremden CDNs). Details siehe [docs/design-tokens.md](docs/design-tokens.md).
- **Routing:** `react-router` (`BrowserRouter`, passend zu `nginx.conf` mit SPA-Fallback)
- **API-Client:** `openapi-typescript` + `openapi-fetch` auf Basis von `openapi/openapi.yaml` -> `src/api/schema.d.ts`
- **Tests:** Vitest + Testing Library (Unit/Komponenten) sowie Playwright (funktionale E2E in Chromium, Firefox, WebKit und Mobil gegen den Produktions-Build; visuelle Regression in Chromium).

## Befehle

```bash
npm ci                # Abhaengigkeiten installieren
npm run dev           # Entwicklungsserver auf http://localhost:5173 (Proxy /v1 -> http://localhost:8080)
npm run typecheck     # TypeScript-Typpruefung
npm run lint          # ESLint-Pruefung
npm run api:generate  # OpenAPI-Typen aus openapi/openapi.yaml nach src/api/schema.d.ts erzeugen
npm test              # Vitest Unit- und Komponententests
npm run test:watch    # Vitest im Watch-Modus
npm run build         # Produktions-Build nach dist/ (inkl. index.html, manifest.webmanifest, sw.js)
npm run preview       # Lokale Vorschau des Produktions-Builds auf http://localhost:4173
npm run test:e2e      # Playwright E2E- und visuelle Tests gegen den Produktions-Build
```

## Testuebersicht

- **Unit- und Komponententests (`npm test`):**
  - Zentraler Dauer-Formatierer (`src/format/dauer.ts`: ganze Sekunden -> `mm:ss` / `h:mm:ss` + `dauerAlsWorte` fuer Screenreader)
  - Datums-Formatierer (`src/format/datum.ts`: ISO -> `TT.MM.JJJJ`)
  - Material-3-Expressive-Farbschema (`src/theme/farbschema.ts`: Hell-/Dunkelpaletten)
  - Typisierter OpenAPI-Client (`src/api/client.ts`: `same-origin`, `FehlerV1`-Auswertung)
  - App-Shell & Routing (`src/App.tsx`: alle Routen, Landmark-Rollen, persistenter Timer-Bereich)
- **Playwright (`npm run test:e2e`):**
  - Funktional (`chromium`, `firefox`, `webkit`, `mobile`): Navigation durch alle Routen, kein horizontales Scrollen auf 360 px, keine Anfragen an fremde Hosts/CDNs, selbst gehostetes Roboto, PWA-Manifest & Service Worker aktiv mit striktem Ausschluss von `/v1`.
  - Visuell (`visuell-chromium`): Startseite Hell & Dunkel auf Desktop (`1280x800`) und Mobil (`360x800`).

## Muss-Kriterien

- Timer fuer Intervalltraining: Trainingsphase und Pause in Zeit einstellbar
- Bedienbar auf dem Smartphone
- Lauffaehig in Safari, Firefox und Chrome auf Mobilgeraeten
- Anmeldung und Registrierung mit Passkeys; mehrere Passkeys pro Benutzer verwaltbar
- Workouts und Calisthenics-Workouts tracken
- Sichtbarkeit von Workouts (privat/oeffentlich) und Einladen von Benutzern
- Design nach Google Material Design 3 Expressive
- Konformitaet mit DSGVO und weiteren EU-Vorgaben
- Funktionstests clientseitig

## Wunsch-Kriterien

- Bedienoberflaeche orientiert an den Usability-Zielen, vor allem den 8 goldenen Regeln nach Shneiderman
- Bedienbar auch am Desktop in Safari, Firefox und Chrome, mit Tastenkuerzeln
- Zusaetzlich als native App baubar (iOS ab 18, Android ab 12)
- Schwimm-Workouts: Bahnen, Zeit pro Bahn, Schwimmtechnik
- Teilen der Trainingsdaten mit Apple Health (setzt eine native iOS-App voraus)
