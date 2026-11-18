# TrainingsappClient

Frontend der Trainingsapp (Intervalltimer und Workout-Tracking). Das zugehoerige Backend liegt in [TrainingsappServer](https://github.com/leon345/TrainingsappServer).

Status: Grundgeruest steht (Build, PWA, Tests). Intervalltimer (C-02) ist die Startseite;
weitere Fachfunktionen folgen.

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
| E2E-Tests | Playwright: funktional in Chromium, Firefox, WebKit und Mobil-Emulation (iPhone, WebKit); Bildvergleiche nur in Chromium |
| Lint | ESLint mit nur einer Regel (Importe der Galerie, E24), Parser `@babel/eslint-parser` |
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
| `npm run dev` | Dev-Server, fest auf http://localhost:5173 (`strictPort`); `/v1` per Proxy an den Server auf http://localhost:8080 |
| `npm run typecheck` | TypeScript-Pruefung (App und Konfiguration/E2E) |
| `npm run lint` | ESLint (nur Regel: Galerie importiert nur Produktionskomponenten) |
| `npm run build` | Typpruefung und Produktions-Build nach `dist/` (ohne Galerie) |
| `npm run build:test` | Typpruefung und Test-Build nach `dist-test/` (`vite build --mode test`, mit `galerie.html`) |
| `npm run preview` | Produktions-Build lokal ausliefern (http://localhost:4173) |
| `npm run preview:test` | Test-Build lokal ausliefern (Galerie unter `/galerie.html`) |
| `npm test` | Unit-Tests (Vitest), einmaliger Lauf |
| `npm run test:watch` | Unit-Tests im Watch-Modus |
| `npm run test:e2e:install` | Playwright-Browser samt Systemabhaengigkeiten installieren |
| `npm run test:e2e` | E2E-Tests in allen neun Projekten (baut beide Builds und startet je ein `vite preview`, siehe unten) |
| `npx playwright test --project=firefox --project=galerie-firefox` | Funktionale E2E-Tests nur fuer einen Browser (`chromium`, `firefox`, `webkit`, `mobile`, jeweils mit `galerie-`-Projekt) |
| `npx playwright test --project=visuell-chromium` | Nur die visuellen Tests (Bildvergleiche, Chromium) |
| `npx playwright test --project=visuell-chromium --update-snapshots` | Referenzbilder neu erzeugen (nur nach gewollten Design-Änderungen) |
| `npx vitest run src/theme -u` | `src/theme/tokens/farbe.css` nach Änderung am Farbgenerator neu schreiben |

Der Service Worker ist nur im Produktions-Build aktiv (`npm run build` und
`npm run preview`), nicht im Dev-Server.

### Produktions-Build und Test-Build (E24)

Die Komponentengalerie (`galerie.html`) ist nur im Test-Build enthalten
(`vite build --mode test`). Es gibt eine `vite.config.ts`; der Mode `test` fuegt
ausschliesslich den Einstieg `galerie.html` hinzu, Plugins und Defines sind gleich.
Der Test-Build landet in `dist-test/`, damit `dist/` immer der Produktions-Build ist.
Im Dev-Server (`npm run dev`) ist `/galerie.html` weiterhin erreichbar.

Welcher Test gegen welchen Build laeuft, legt `playwright.config.ts` fest:

| Playwright-Projekte | Build und Server | Tests |
| --- | --- | --- |
| `chromium`, `firefox`, `webkit`, `mobile` | Produktions-Build, `vite preview` auf Port 4173 | funktionale Tests ohne Tag: `e2e/timer.spec.ts` (Timer: Einstellung, Ablauf, Zeitsprung, Pause 0, Grenzen, Speicherung, Tastatur, Smartphone-Groesse, Wake Lock; seit C-09 Einstellung per Tastatur, Neuladen im Lauf, gesperrter oder voller `localStorage`), `e2e/app.spec.ts` (Startseite und Start-Button, Tab fokussiert den ersten Button, Layout ohne horizontales Scrollen, PWA-Manifest, Service Worker ausgeliefert und registriert, keine fremden Hosts), `e2e/produktions-build.spec.ts` (Produktions-Build ohne Galerie: Dateien in `dist/`, Precache-Liste in `dist/sw.js`, Inhalt, `/galerie.html`), aus `e2e/visuell.spec.ts` Roboto selbst gehostet geladen und verwendet (Startseite) und dunkles Schema; seit C-03 `e2e/navigation.spec.ts` (Leiste fest unten, verdeckt am Seitenende nichts), `e2e/konto.spec.ts` (Konto mit Server-Attrappe fuer `/v1`, WebAuthn als Attrappe), `e2e/konto-webauthn.spec.ts` (nur Chromium: virtueller Authenticator per CDP, in den anderen Projekten uebersprungen) |
| `galerie-chromium`, `galerie-firefox`, `galerie-webkit`, `galerie-mobile` | Test-Build, `vite preview` auf Port 4174 | funktionale Tests, die die Galerie brauchen (Tag `@galerie` ohne `@visuell`): Textfeld-Label schwebt bei Fokus (gemessene Lage und Groesse, kein Bildvergleich), keine fremden Hosts der Galerie |
| `visuell-chromium` | Test-Build, `vite preview` auf Port 4174 | nur Bildvergleiche (Tag `@visuell`): Galerie-Abschnitte hell und dunkel, Fokusring, schwebendes Textfeld-Label, Startseite hell und dunkel, Timer auf Smartphone-Groesse (bereit hell/dunkel, laufend hell), Galerie-Abschnitt Schalter (C-17), Leiste fest unten (Mobil, hell/dunkel), `e2e/konto-visuell.spec.ts`: Konto-Ansicht in der App mit Server-Attrappe (abgemeldet, zwei Passkeys, ein Passkey mit Hinweis, Server nicht erreichbar; hell/dunkel). Ganzseiten-Aufnahmen loesen die feste Leiste nur fuer die Aufnahme (`e2e/ganzseite.css`) |

Die visuellen Tests laufen nur in Chromium (Vorgabe des Nutzers). Das Aussehen in
Firefox, WebKit und der Mobil-Emulation wird **nicht** automatisch geprueft; dort
laufen nur die funktionalen Tests. Funktionale Aussagen aus Bildvergleichen sind
zusaetzlich ohne Bild in allen Browsern abgedeckt: Tab-Fokus auf den ersten Button
(Startseite) und schwebendes Textfeld-Label (Galerie). Nur in Chromium geprueft
werden das Aussehen, etwa Fokusring, Farben und Schrift-Darstellung. Referenzbilder gibt es nur fuer Chromium unter
Linux (`e2e/visuell.spec.ts-snapshots/*-chromium-linux.png`).

Damit die Galerie nur zeigt, was ausgeliefert wird, erlaubt eine ESLint-Regel
(`no-restricted-imports`, `eslint.config.js`) in `src/galerie/` nur Importe aus
`src/components/` (ohne Testdateien), `src/styles.ts`, React und der Galerie selbst.

## Projektstruktur

```
index.html            Einstiegsseite
galerie.html          Komponentengalerie (nur im Test-Build, Grundlage der visuellen Tests)
public/               Statische Dateien (Favicon, PWA-Icons)
src/main.tsx          Einstieg, rendert <App />
src/styles.ts         Globale Stile (Schrift, Token-Paket, Rahmen)
src/App.tsx           Anwendungsrahmen (Startseite: Timer, Umschalter Timer/Konto)
src/konto/            Konto: API-Schicht, WebAuthn-Aufrufe, Zustandslogik, Ansicht (C-03)
src/timer/            Intervalltimer: Logik, Einstellung, Hooks, Ansicht (C-02)
src/format/           Zentraler Dauer-Formatierer (mm:ss / h:mm:ss, E21), Kalendertag (TT.MM.JJJJ)
src/theme/            Token-Paket Material 3 Expressive (CSS-Variablen)
src/components/ui/    Grundkomponenten (Button, IconButton, Icon, Card, TextField, NumberField, CircularProgress)
src/galerie/          Komponentengalerie
docs/                 Design-Tokens und Komponentenumfang
src/test/setup.ts     Vitest-Setup (jest-dom-Matcher)
e2e/                  Playwright-Tests
vite.config.ts        Vite-, PWA- und Vitest-Konfiguration (Mode `test`: mit Galerie)
playwright.config.ts  Playwright-Projekte und Webserver (Produktions- und Test-Build)
eslint.config.js      ESLint, nur Import-Regel fuer die Galerie
```

## Intervalltimer (C-02)

- Trainings- und Pausenzeit in ganzen Sekunden, Standard 30 s / 10 s (E20). Grenzen
  wie im Server: Training 1 bis 86400 s, Pause 0 bis 86400 s (0 = keine Pause).
  Werte ausserhalb werden beim Verlassen des Felds auf die Grenze gesetzt.
- Die Einstellung wird nur lokal gespeichert (`localStorage`, Schluessel
  `trainingsapp.timer.einstellung.v1`). Der Abgleich mit dem Server folgt mit S-02b (E10).
- Runden (Training plus Pause) wiederholen sich, bis der Benutzer anhaelt. Der
  Laufzustand wird nicht gespeichert; Neuladen setzt zurueck.
- Die Restzeit wird aus Zeitstempeln (`Date.now`) berechnet, nicht aus Takten (E1).
  Der Takt (250 ms) loest nur das Neuzeichnen aus. Logik ohne Browser in
  `src/timer/logik.ts`, getestet mit kontrollierter Uhr.
- Waehrend der Timer laeuft, wird eine Screen-Wake-Lock-Sperre angefordert und nach
  Rueckkehr in den Vordergrund erneuert. Fehlt die API oder wird sie abgelehnt, laeuft
  der Timer trotzdem korrekt, nur kann der Bildschirm ausgehen.
- Anzeige ueber den zentralen Formatierer `src/format/dauer.ts`; Screenreader hoeren die
  Restzeit in Worten (`role="timer"`) und eine Ansage nur beim Phasenwechsel.
- Nicht geprueft: Verhalten in echtem iOS-Safari bei gesperrtem Bildschirm und ob Wake
  Lock auf echten Geraeten greift (C-01b).

### Phasensignale (C-17, E33)

- Jeder Phasenwechsel wird genau einmal signalisiert; nach Rueckkehr aus dem Hintergrund
  nur der letzte Wechsel (`src/timer/phasenwechsel.ts`, Port `PhasenSignal`).
- Ton per Web Audio (Sinus, Huellkurve): zu Training zwei Toene 880 Hz je 120 ms, zu
  Pause ein Ton 440 Hz, 200 ms. Der AudioContext wird beim Tippen auf Start/Fortsetzen
  bzw. beim Einschalten des Tons entsperrt.
- Vibration per `navigator.vibrate`: Training `[200]`, Pause `[100,100,100]`.
- Sichtbar immer: Die Phasenanzeige unter dem Ring wechselt Text und Farbe; sie ist die
  einzige Live-Region (`aria-live="polite"`), der Wechsel wird nur einmal angesagt.
- Schalter Ton und Vibration, Standard an, lokal unter `trainingsapp.timer.signale.v1`.
  Ohne `navigator.vibrate` ist der Vibrationsschalter deaktiviert, mit Hinweis.
- Ohne Unterstuetzung im Browser: Fehlt Web Audio oder lehnt der Browser `resume()` ab,
  bleibt es still; fehlt `vibrate` oder wirft es, vibriert nichts. Timer und sichtbares
  Signal laufen in jedem Fall weiter. In den Playwright-Browsern gibt es `vibrate` nur in
  Chromium (Firefox, WebKit und die iPhone-Emulation melden es nicht); einen
  AudioContext gibt es in allen vieren.
- Beim Anhalten kein Signal. Ein Signal fuer "Ende" gibt es nicht, weil der Timer kein
  Ende kennt (offener Punkt aus E33).
- Nur auf echten Geraeten pruefbar (offen fuer C-01b): ob Ton und Vibration hoer- bzw.
  spuerbar sind, das Verhalten in iOS-Safari (dort fehlt `vibrate` voraussichtlich),
  bei gesperrtem Bildschirm und mit Stummschalter. Die automatischen Tests ersetzen
  AudioContext und `vibrate` durch Attrappen und pruefen nur, was ausgeloest wird.

## Konto und Passkeys (C-03, Prototyp)

- Die Ansicht "Konto" erreicht man ueber die Navigationsleiste unten (Timer / Konto),
  ohne Routing-Bibliothek. Der Timer bleibt die erste Ansicht und bleibt beim Wechsel
  eingehaengt (nur verborgen): Ein laufender Timer laeuft samt Ton, Vibration und Wake
  Lock weiter. Die Navigation steht im DOM hinter dem Inhalt, Tab erreicht zuerst Start.
- Erst beim Oeffnen der Konto-Ansicht fragt der Client `GET /v1/passkeys`: 200 heisst
  angemeldet, 401 nicht angemeldet. Der Timer braucht weder Anmeldung noch Server.
- Nicht angemeldet: Registrieren (Benutzername nach E28, Hinweis zur Namensregel am Feld,
  wird klein geschrieben gesendet) und Anmelden ohne Benutzernamen (discoverable Passkey).
- Angemeldet: Passkey-Liste (Bezeichnung nur als Text, erstellt am, zuletzt verwendet bzw.
  "noch nie"), weiteren Passkey hinzufuegen, Abmelden. Hinweis auf einen zweiten Passkey
  nach der Registrierung und immer, wenn nur ein Passkey existiert (E3), ausblendbar.
- Nicht im Prototyp: Umbenennen und Loeschen von Passkeys, Timer-Einstellung auf dem Server.
- Formate wie der Server-E2E-Test `PasskeyBrowserE2ETest`: Optionen per
  `PublicKeyCredential.parseCreationOptionsFromJSON` / `parseRequestOptionsFromJSON`,
  Ergebnis per `credential.toJSON()`. Fehler im Format `FehlerV1`; 429 mit `Retry-After`.
- Sitzung per HttpOnly-Cookie derselben Origin (E15). Lokal: Server im Dev-Modus auf
  Port 8080, Client mit `npm run dev` auf Port 5173 (Proxy fuer `/v1`).
- Der Service Worker beantwortet nichts unter `/v1`: kein Precache, kein Runtime-Caching,
  Navigationen nach `/v1` bekommen nicht die Startseite (`navigateFallbackDenylist`).

**Bekannte Einschraenkung:** Browser ohne `PublicKeyCredential.parseCreationOptionsFromJSON`,
`parseRequestOptionsFromJSON` oder `toJSON()` (z. B. aeltere Safari-Versionen) gelten als
"unterstuetzt keine Passkeys". Die Konto-Ansicht zeigt dann einen Hinweis und sperrt
Registrieren und Anmelden; eine eigene Umwandlung (Base64URL) gibt es bewusst nicht. Der
Timer funktioniert dort unveraendert. Auch Playwright-WebKit unter Linux (Projekte `webkit`
und `mobile`) hat diese Funktionen nicht; die E2E-Tests ersetzen WebAuthn dort durch eine
Attrappe, echte Abfragen laufen nur in Chromium mit virtuellem Authenticator.

## Funktionstests (C-09)

Alle Tests lokal: `npm test` (Vitest) und `npm run test:e2e` (Playwright, baut beide
Builds selbst). Laeuft auf Port 4173 oder 4174 schon ein Server, verwendet Playwright
ausserhalb von CI diesen (`reuseExistingServer`); vor dem Lauf also keinen fremden
`vite preview` offen lassen.

E2E-Tests mit Zeit installieren `page.clock` und halten die Uhr nach dem Laden an
(`e2e/uhr.ts`). Ohne Anhalten liefe sie mit der echten Zeit weiter, und exakte
Anzeigen wie `00:09` wackelten unter Last.

| Muss-Funktion | Tests |
| --- | --- |
| Intervalltimer | `src/timer/*.test.ts(x)` (Logik mit kontrollierter Uhr, Einstellung und Speicherung, Hooks, Ansicht, Phasensignale), `src/format/dauer.test.ts` (Formatierer, Grenzwerte E21), `e2e/timer.spec.ts` und `e2e/phasensignale.spec.ts` (alle vier Browser, Ton und Vibration als Attrappen) |
| Bedienbar auf dem Smartphone | `e2e/timer.spec.ts` (360 px, Zielflaechen), Projekt `mobile` |
| Offline-Start (PWA) | `e2e/service-worker-cache.spec.ts` (auch: `/v1` geht am Service Worker vorbei) |
| Passkeys (C-03) | `src/konto/*.test.ts(x)` (API-Schicht, WebAuthn-Schnittstelle, Benutzername E28, Zustandslogik, Ansicht mit Attrappen fuer API und WebAuthn), `src/App.konto.test.tsx` (Umschalten, Timer laeuft weiter); `e2e/konto.spec.ts` (alle vier Browser, Server-Attrappe `e2e/konto-server.ts` nach OpenAPI und Server-Code), `e2e/konto-webauthn.spec.ts` (Chromium, virtueller Authenticator); Durchlauf gegen den echten Server steht aus |
| Workouts, Sichtbarkeit | noch keine Tests: Die Funktionen fehlen im Client (C-04, C-05) |

## Offene Entscheidungen

- Pruefung auf iOS-Geraet (Spike C-01b): Timer bei gesperrtem Bildschirm, Passkeys im
  Capacitor-WebView.
