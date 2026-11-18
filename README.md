# TrainingsappClient

Frontend der Trainingsapp (Intervalltimer und Workout-Tracking). Das zugehoerige Backend liegt in [TrainingsappServer](https://github.com/leon345/TrainingsappServer).

Status: Grundgeruest steht (Build, PWA, Tests). Fachfunktionen folgen.

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

## Stack

| Bereich | Technik |
| --- | --- |
| UI | React 19, TypeScript |
| Build und Dev-Server | Vite |
| PWA | `vite-plugin-pwa` (Web-App-Manifest, Service Worker per Workbox, automatische Aktualisierung) |
| Bedienelemente | React Aria Components (Barrierefreiheit), Aussehen nach Material 3 Expressive aus eigenem Token-Paket |
| Farbschemata | `@material/material-color-utilities` (Generator `src/theme/farbschema.ts`) |
| Unit-Tests | Vitest mit jsdom und Testing Library |
| E2E-Tests | Playwright: Chromium, Firefox, WebKit und Mobil-Emulation (iPhone, WebKit) |
| Paketmanager | npm (`package-lock.json` gehoert ins Repo) |

Eine Codebasis fuer Mobil und Desktop: Das Layout ist mobil zuerst aufgebaut und
erweitert sich ab 840 px Breite. Eine native Huelle per Capacitor folgt spaeter (C-11).

### Regeln

- Keine fremden CDNs. Schriften und Icons werden selbst gehostet, also als npm-Paket
  mitgebaut oder als Datei unter `public/` abgelegt. Ein E2E-Test prueft, dass die
  Startseite keine fremden Hosts anfragt.
- Kein `@material/web`. Design-Tokens nach Material 3 Expressive liegen als eigene
  CSS-Variablen unter `src/theme/`, Grundkomponenten auf React Aria unter
  `src/components/ui/`. Herkunft der Werte und Komponentenumfang:
  [docs/design-tokens.md](docs/design-tokens.md).
- Schrift Roboto (`@fontsource-variable/roboto`, OFL 1.1) und Icons Material Symbols
  (`@material-symbols/svg-400`, Apache 2.0) werden mitgebaut.
- Dauern werden projektweit in ganzen Sekunden als Integer gefuehrt (`dauerSekunden`,
  `pauseSekunden`), kein ISO-8601.

## Voraussetzungen

- Node.js 22.22.2 oder neuer innerhalb von 22.x, 24.15 oder neuer innerhalb von 24.x,
  oder ab 26 (Vorgabe von jsdom 31), dazu npm
- Fuer E2E-Tests die Playwright-Browser (siehe unten). `npm run test:e2e:install`
  installiert auch die Systembibliotheken und braucht dafuer root-Rechte (sudo).
  Ohne root: `npx playwright install chromium firefox webkit` laedt nur die Browser.
  Fehlende Bibliotheken muss dann ein Administrator mit
  `sudo npx playwright install-deps` nachinstallieren (WebKit braucht unter Linux
  u. a. `libevent`, `libavif` und `libmanette`).

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm install` | Abhaengigkeiten installieren |
| `npm run dev` | Dev-Server (http://localhost:5173) |
| `npm run typecheck` | TypeScript-Pruefung (App und Konfiguration/E2E) |
| `npm run build` | Typpruefung und Produktions-Build nach `dist/` |
| `npm run preview` | Produktions-Build lokal ausliefern (http://localhost:4173) |
| `npm test` | Unit-Tests (Vitest), einmaliger Lauf |
| `npm run test:watch` | Unit-Tests im Watch-Modus |
| `npm run test:e2e:install` | Playwright-Browser samt Systemabhaengigkeiten installieren |
| `npm run test:e2e` | E2E-Tests in allen vier Projekten (baut vorher und startet `vite preview`) |
| `npx playwright test --project=chromium` | E2E-Tests nur in einem Projekt (`chromium`, `firefox`, `webkit`, `mobile`) |
| `npx playwright test e2e/visuell.spec.ts --update-snapshots` | Referenzbilder der visuellen Tests neu erzeugen (nur nach gewollten Design-Änderungen) |
| `npx vitest run src/theme -u` | `src/theme/tokens/farbe.css` nach Änderung am Farbgenerator neu schreiben |

Der Service Worker ist nur im Produktions-Build aktiv (`npm run build` und
`npm run preview`), nicht im Dev-Server.

## Projektstruktur

```
index.html            Einstiegsseite
galerie.html          Komponentengalerie (Grundlage der visuellen Tests)
public/               Statische Dateien (Favicon, PWA-Icons)
src/main.tsx          Einstieg, rendert <App />
src/styles.ts         Globale Stile (Schrift, Token-Paket, Rahmen)
src/App.tsx           Anwendungsrahmen
src/theme/            Token-Paket Material 3 Expressive (CSS-Variablen)
src/components/ui/    Grundkomponenten (Button, IconButton, Icon, Card, TextField)
src/components/       Weitere Komponenten (BeispielButton)
src/galerie/          Komponentengalerie
docs/                 Design-Tokens und Komponentenumfang
src/test/setup.ts     Vitest-Setup (jest-dom-Matcher)
e2e/                  Playwright-Tests
vite.config.ts        Vite-, PWA- und Vitest-Konfiguration
playwright.config.ts  Playwright-Projekte und Webserver
```

## Offene Entscheidungen

- Pruefung auf iOS-Geraet (Spike C-01b): Timer bei gesperrtem Bildschirm, Passkeys im
  Capacitor-WebView.
