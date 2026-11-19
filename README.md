> [!NOTE]
> **KI-Hinweis:** Dieses Projekt wurde vollständig mit KI-Agenten erstellt (Proof of Concept / „vibe-coded“). Keine Gewähr für Sicherheit, Vollständigkeit oder Verfügbarkeit.

# TrainingsappClient

Frontend der Trainingsapp (Intervalltimer, Passkey-Konto, Workout-Tracking, Teilen/Einladungen und DSGVO-Funktionen) als Progressive Web App (PWA). Das zugehörige Backend liegt in [TrainingsappServer](https://github.com/leon345/TrainingsappServer).

Status: Vollständige Umsetzung der Muss-Kriterien (`GC-01`–`GC-05`).

## Technologie-Stack

- **Basis:** React 19, TypeScript (strict), Vite, PWA (`vite-plugin-pwa` / Workbox)
- **Design-System:** `@mui/material` mit Material-3-Expressive-Theme (Farbpaletten aus `@material/material-color-utilities`, selbst gehostete Schrift via `@fontsource-variable/roboto`, lokale Icons via `@mui/icons-material` – keine fremden CDNs). Details siehe [docs/design-tokens.md](docs/design-tokens.md).
- **Routing:** `react-router` (`BrowserRouter`, passend zu `nginx.conf` mit SPA-Fallback)
- **API-Client:** `openapi-typescript` + `openapi-fetch` auf Basis von `openapi/openapi.yaml` -> `src/api/schema.d.ts`
- **Tests:** Vitest + Testing Library (Unit/Komponenten) sowie Playwright (funktionale E2E in Chromium, Firefox, WebKit und Mobil gegen den Produktions-Build; visuelle Regression in Chromium; Fullstack-Integration gegen den laufenden Quarkus-Server).

## Funktionsumfang

- **Intervalltimer (`/`):** Zeitstempel-basierte Trainings- und Pausenphasen in ganzen Sekunden (`integer`), lokaler Speicher + automatische Server-Synchronisation nach Anmeldung (`GET`/`PUT /v1/timer/einstellung`), Phasensignale über Web Audio (ohne Audiodateien), Vibration (Feature-Detection) und `aria-live="polite"`, Screen Wake Lock, dauerhaft aktiv bei Tab-Wechsel.
- **Konto & Passkeys (`/konto`):** Passwortlose Registrierung und Anmeldung per Passkey (WebAuthn, inkl. Discoverable Login), Multi-Passkey-Verwaltung (Hinzufügen, Umbenennen, Löschen mit Schutz des letzten Passkeys), DSGVO-JSON-Datenexport (`GET /v1/dsgvo/export`) und zweistufige Kontolöschung (`DELETE /v1/konto`).
- **Workout-Tracking (`/workouts`, `/workouts/neu`, `/workouts/:id`):** Kraft- und Calisthenics-Workouts mit Übungen, Progressionsvarianten, Sätzen (Wiederholungen, Haltedauer, Gewicht, Pause), optimistischer Sperre (`409`-Konfliktbehandlung), Sichtbarkeitsumschaltung (`PRIVAT`/`OEFFENTLICH`) sowie gezielten Benutzer-Einladungen per exaktem Benutzernamen.
- **Entdecken & Profile (`/entdecken`, `/profil/:benutzerId`):** Mit dem eigenen Konto geteilte Workouts (schreibgeschützt ansehbar) und exakte Benutzernamenssuche für öffentliche Profile.
- **Datenschutz & PoC-Hinweis (`/datenschutz`):** Vollständige Datenschutzerklärung, rechtliche Hinweise und durchgängiger PoC-Hinweis (Startseite, Registrierung, Footer, Datenschutzerklärung).

## Befehle

```bash
npm ci                       # Abhängigkeiten installieren
npm run dev                  # Entwicklungsserver auf http://localhost:5173 (Proxy /v1 -> http://localhost:8080)
npm run typecheck            # TypeScript-Typprüfung
npm run lint                 # ESLint-Prüfung
npm run api:generate         # OpenAPI-Typen aus openapi/openapi.yaml nach src/api/schema.d.ts erzeugen
npm test                     # Vitest Unit- und Komponententests
npm run test:watch           # Vitest im Watch-Modus
npm run build                # Produktions-Build nach dist/ (inkl. index.html, manifest.webmanifest, sw.js)
npm run preview              # Lokale Vorschau des Produktions-Builds auf http://localhost:4173
npm run test:e2e             # Playwright E2E- (4 Browser-Projekte) und visuelle Tests (Chromium) gegen dist/
npm run test:e2e:integration # Playwright Fullstack-E2E gegen laufenden Quarkus-Server (Chromium CDP WebAuthn)
npm audit --omit=dev         # Sicherheitsprüfung der Produktions-Abhängigkeiten (siehe docs/dependency-audit.md)
```

## Testübersicht

- **Unit- und Komponententests (`npm test`):**
  - Formatierer (`src/format/dauer.ts`, `src/format/datum.ts`), Material-3-Expressive-Farbschema (`src/theme/farbschema.ts`), API-Client (`src/api/client.ts`)
  - Intervalltimer, Web Audio, Vibration, Wake Lock & Speicher (`src/timer/*`, `src/pages/TimerSeite.test.tsx`)
  - Passkeys, AuthContext, DSGVO-Export & zweistufige Kontolöschung (`src/konto/*`, `src/pages/KontoSeite.test.tsx`)
  - Workouts, Sichtbarkeit, Einladungen & Schreibschutz (`src/workouts/*`, `src/pages/WorkoutsSeite.test.tsx`, `src/pages/WorkoutDetailSeite.test.tsx`)
  - Entdecken, Profile, Datenschutz & Navigation (`src/pages/EntdeckenSeite.test.tsx`, `src/pages/ProfilSeite.test.tsx`, `src/pages/DatenschutzSeite.test.tsx`, `src/App.test.tsx`)
- **Playwright (`npm run test:e2e`):**
  - Funktional (`chromium`, `firefox`, `webkit`, `mobile`): Navigation, Intervalltimer, Passkey-Konto, Workouts, Sichtbarkeit & Einladungen, Entdecken & Profile, DSGVO-Export & Kontolöschung, PoC-Hinweis, kein horizontales Scrollen auf 360 px, keine fremden Hosts/CDNs, selbst gehostetes Roboto, PWA-Manifest & Service-Worker-Cache (statische Assets gecacht, `/v1/*` strikt ausgeschlossen, kein `galerie*` in `dist/`).
  - Visuell (`visuell-chromium`): Startseite (Hell/Dunkel, Desktop/Mobil), laufender Timer, Konto (abgemeldet/angemeldet), Workouts (Übersicht & Formular), Entdecken und Datenschutz.
- **Fullstack-Integration (`npm run test:e2e:integration`):**
  - Chromium CDP Virtual Authenticator gegen laufenden Quarkus-Server: Registrierung, 2. Passkey, Umbenennen, Timer-Sync + Reload, Discoverable Login, Workout-CRUD sowie 2-Nutzer-Flow (Sichtbarkeit `OEFFENTLICH`, Einladung, Profil-Ansicht, JSON-Export & Kontolöschung).
