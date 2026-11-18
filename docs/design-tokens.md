# Design-Tokens und Komponenten: Material 3 Expressive (C-06)

Stand: 18.11.2026. Grundlage: Entscheidung E2 (kein `@material/web`, eigenes
Token-Paket mit CSS-Variablen, Farben über `@material/material-color-utilities`,
Komponenten auf React Aria Components, Schriften und Icons selbst gehostet).

## 1. Was lässt sich übernehmen? (offene Frage aus E2)

| Quelle | Was sie liefert | Expressive? | Genutzt für |
| --- | --- | --- | --- |
| **Material Theme Builder** (Web und Figma-Plugin) | Farbschemata und Schriftwahl; Export nach Android Views, Jetpack Compose, DSP (laut m3.material.io, "Design tokens > How to use tokens", und Blog "Introducing Material Theme Builder"). Formen und Bewegung exportiert er nicht. Laut GitHub-Issue material-foundation/material-theme-builder#393 ("Add support for Material 3 Expressive tokens", ab Juni 2025) fehlen die Expressive-Tokens im Builder. | nein | nicht genutzt |
| **`@material/material-color-utilities` 0.4.0** (Apache-2.0) | Dynamische Farbschemata, inkl. Farbspezifikation `2025` (das Expressive-Farbsystem) neben `2021` | ja (Farbe) | alle `md.sys.color.*` |
| **material-web, `tokens/versions/latest/sass/`** (Repo material-components/material-web, Commit `c6e9a66`, Apache-2.0) | Automatisch erzeugte Token-Dateien aus der Token-Datenbank "Google Material 3", Version 34.0.21, Kontext `platform: web`. Enthält Expressive-Formen und Emphasized-Typo, aber nur die Standard-Federn. Wir nutzen nur die Werte, nicht das Paket `@material/web`. | teilweise | Form, Typo, Höhe, Zustand, Fokus, Easing/Dauer, Standard-Federn |
| **Jetpack Compose Material 3** (Repo androidx/androidx, `compose/material3/.../tokens/*.kt`, Commit `cea944e`, Apache-2.0) | Erzeugte Token-Objekte, u. a. `ExpressiveMotionTokens`, `StandardMotionTokens`, `ShapeTokens` und Komponenten-Tokens (Button, Icon-Button, Card, Textfeld) | ja | Expressive-Federn, Komponenten-Tokens |
| **m3.material.io** (Motion > Overview > Specs, "Web: Convert springs to curves") | Umrechnung jeder Feder in `cubic-bezier` und Dauer für das Web | ja | Web-Kurven der Bewegung |

Ergebnis: Aus dem Theme Builder lässt sich nichts Expressive-Spezifisches
exportieren. Die Werte kommen aus den erzeugten Token-Dateien von material-web
und Compose sowie aus der Spezifikation und wurden von Hand in CSS-Variablen
übertragen (Arbeitsannahme aus E2 bestätigt). Die Farben erzeugt die
Bibliothek. Ein Generator schreibt sie in eine Datei, die mit eingecheckt wird.

Hinweis: m3.material.io lädt seine Inhalte per JavaScript. Die Tabelle
"Web: Convert springs to curves" ist der Text der Seite, wie ihn die Websuche
am 18.11.2026 indexiert hatte. Gegengeprüft gegen zwei unabhängige Abschriften
derselben Seite auf GitHub (Glavo/md3-reference-hub, mfskys/md3e-skill).

## 2. Token-Paket (`src/theme/`)

Einbindung: `src/styles.ts` lädt Schrift, `src/theme/index.css` und den
Anwendungsrahmen. Alle Tokens sind CSS-Variablen auf `:root`, benannt nach
dem Token-Namen (`md.sys.color.primary` → `--md-sys-color-primary`).

| Datei | Tokens | Anzahl | Herkunft |
| --- | --- | --- | --- |
| `tokens/farbe.css` (generiert) | `--md-sys-color-*` hell, dunkel, je Standard- und hoher Kontrast | 53 Rollen je Schema | material-color-utilities, siehe 2.1 |
| `tokens/form.css` | `--md-sys-shape-corner-*` inkl. `large-increased` (20px), `extra-large-increased` (32px), `extra-extra-large` (48px) | 15 | material-web `_md-sys-shape.scss`, gleich Compose `ShapeTokens.kt` |
| `tokens/typografie.css` | `--md-ref-typeface-*`, `--md-sys-typescale-*` (15 Baseline-Stile) und `--md-sys-typescale-emphasized-*` (15 Emphasized-Stile), je Schrift, Größe, Zeilenhöhe, Laufweite, Gewicht | 5 + 150 | material-web `_md-ref-typeface.scss`, `_md-sys-typescale.scss`, `_md-sys-typescale-emphasized.scss` |
| `tokens/bewegung.css` | Federn (`-damping`, `-stiffness`) für fast/default/slow × spatial/effects, Web-Kurven (`-easing`, `-duration`), klassische Easing- und Dauer-Tokens | 12 + 12 + 26 | siehe 2.2 |
| `tokens/hoehe-und-zustand.css` | `--md-sys-elevation-level0..5`, `--md-sys-state-*-opacity`, `--md-sys-state-focus-indicator-*` | 6 + 5 + 3 | material-web `_md-sys-elevation.scss`, `_md-sys-state.scss`, `_md-sys-state-focus-indicator.scss` |
| `typografie-klassen.css` | Hilfsklassen `.md-typescale-<rolle>` und `.md-typescale-emphasized-<rolle>` | 30 | abgeleitet |
| `basis.css` | Grundfarben, Grundschrift, sichtbarer Fokus | – | abgeleitet |

### 2.1 Farbe

- Erzeugt von `src/theme/farbschema.ts` mit `SchemeTonalSpot`,
  Farbspezifikation `2025`, Plattform `phone`.
- Der Test `src/theme/farbschema.test.ts` prüft, dass `tokens/farbe.css` genau
  der Ausgabe des Generators entspricht. Neu schreiben: `npx vitest run src/theme -u`.
- Auswahl: Systemeinstellung `prefers-color-scheme`, übersteuerbar mit
  `data-theme="light"` oder `data-theme="dark"` am `<html>`. Bei
  `prefers-contrast: more` greift das Schema mit Kontraststufe 1.
- Der Test prüft außerdem für alle vier Schemata die Kontraste der wichtigsten
  Text-Hintergrund-Paare (mindestens 4,5:1) und von `outline` auf `surface`
  (mindestens 3:1), Ziel WCAG 2.1 AA (E7).
- Ergänzt: `surface-variant`, `shadow`, `scrim`, `surface-tint`. Die Bibliothek
  führt sie nicht in `allColors`, bietet sie aber als Rollen an.

### 2.2 Bewegung

- Federn, Schema **expressive** (Standard der App): Compose
  `ExpressiveMotionTokens.kt`: fast spatial 0.6/800, default spatial 0.8/380,
  slow spatial 0.8/200, effects 1/3800, 1/1600, 1/800 (Dämpfung/Steifigkeit).
- Federn, Schema **standard** (`data-motion-scheme="standard"`): material-web
  `_md-sys-motion.scss` und Compose `StandardMotionTokens.kt`: spatial 0.9 mit
  1400/700/300, effects wie expressive.
- Web-Kurven (CSS kann keine Federn): m3.material.io, Tabelle "Web: Convert
  springs to curves", z. B. expressive fast spatial
  `cubic-bezier(0.42, 1.67, 0.21, 0.90)` über 350 ms.
- Klassische Easing- und Dauer-Tokens: material-web `_md-sys-motion.scss`.
  Laut Spezifikation sind sie für das Federsystem nicht mehr nötig. Sie bleiben
  als Rückfall für Übergänge zwischen Ansichten.
- Komponenten nutzen "fast spatial" (Form) und "fast effects" (Farbe,
  Deckkraft). Laut m3.material.io (Motion > How it works) ist das die Regel für
  alle Komponenten.

### 2.3 Eigene Festlegungen (nicht aus Spezifikation oder Token-Dateien)

| Festlegung | Wert | Grund |
| --- | --- | --- |
| Quellfarbe | `#6750a4` (= `md.ref.palette.primary40` der M3-Baseline) | Es gibt noch keine Markenfarbe. Austauschbar in `farbschema.ts`. |
| Schema-Variante | `SchemeTonalSpot` | Standardvariante von M3. "Expressive" im Bibliotheksnamen `SchemeExpressive` ist eine verspielte Variante, nicht M3 Expressive. |
| Kontraststufe für `prefers-contrast: more` | 1,0 | Barrierefreiheit |
| Gewicht der Typo-Stile | Wert der Achse `wght` (Emphasized: 500/600) statt des statischen Gewichts (500/700) | Roboto ist als variable Schrift eingebunden. Beide Werte stehen in den Token-Dateien. |
| Ersatzschriften | `Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif` | falls die Schrift nicht lädt |
| Schattenwerte `--app-elevation-shadow-level*` | nachgebaut aus material-web `elevation/internal/_elevation.scss` | Die Spezifikation gibt nur Höhen in dp an |
| Reduzierte Bewegung | räumliche Dauern 0 ms bei `prefers-reduced-motion: reduce` | Barrierefreiheit, keine M3-Vorgabe |
| Ecke "full" bei Buttons | halbe Höhe statt 9999px | Sonst springt der Form-Morph beim Drücken statt zu animieren |
| Zielfläche | mindestens 48 × 48 px auch bei 40 px hohen Buttons | M3-Empfehlung zur Zielfläche, Bedienung auf dem Smartphone |
| Textfeld | Höhe 56 px, Innenabstand 16 px, Deaktiviert als Deckkraft 38 % des ganzen Felds | Farb- und Typo-Tokens aus Compose, die Maße dort nicht als Token |
| Card | Innenabstand 16 px | kein Token vorhanden |
| Prefix `--app-` | für Werte, die keine M3-Tokens sind (Schatten, Fokusfarbe) | Abgrenzung zu `--md-` |

## 3. Komponenten (`src/components/ui/`)

Alle Bedienelemente bauen auf React Aria Components auf. Tastatur, Touch,
Fokus, Deaktivierung und die ARIA-Verknüpfungen kommen von dort.

| Komponente | Varianten | Komponenten-Tokens (Compose) | Expressive-Merkmal |
| --- | --- | --- | --- |
| `Button` | filled, tonal, outlined, text; Größe small (40 px) und medium (56 px); Form round/square; optionales Icon | `ButtonSmallTokens`, `ButtonMediumTokens`, `FilledButtonTokens`, `TonalButtonTokens`, `OutlinedButtonTokens`, `TextButtonTokens`, Textstil nach `ButtonDefaults.textStyleFor` | Größen, runde/eckige Form, Form-Morph beim Drücken (small → `corner-small`, medium → `corner-medium`) mit Feder "fast spatial" |
| `IconButton` | standard, filled, tonal, outlined; Größe small | `SmallIconButtonTokens`, `IconButtonTokens`, `FilledIconButtonTokens`, `FilledTonalIconButtonTokens`, `OutlinedIconButtonTokens` | Form-Morph beim Drücken |
| `Icon` | 17 Material Symbols (Rounded, 400) | Größe 24 px | – |
| `Card` | filled, outlined; wählbares HTML-Element | `FilledCardTokens`, `OutlinedCardTokens` | – |
| `TextField` | filled; Label, Hilfetext, Fehlertext, deaktiviert | `FilledTextFieldTokens` | schwebendes Label mit Feder "fast spatial" |
| `Button` large (C-02) | wie `Button`, Größe large (96 px) | `ButtonLargeTokens` (androidx-main, abgerufen 18.11.2026): Höhe 96, Abstand 48, Icon 32, Icon-Abstand 12, eckig `corner-extra-large`, gedrückt `corner-large`, Rand 2; Textstil headline-small | Form-Morph beim Drücken |
| `NumberField` (C-02) | ganze Zahlen, Aussehen wie `TextField` (filled), Label, Hilfetext, Fehlertext, deaktiviert | wie `TextField` | schwebendes Label |
| `CircularProgress` (C-02) | bestimmt, Größe und Dicke wählbar, Inhalt in der Mitte | `CircularProgressIndicatorTokens` (androidx-main): Dicke 4, Abstand Indikator–Spur 4, Größe 40; Farben primary / secondary-container; runde Enden | Lücke zwischen Indikator und Spur |

Zustände: Zustandsebene mit `md.sys.state.*`-Deckkraft (hover, focus,
pressed), Fokusring 3 px in `secondary` mit 2 px Abstand (material-web
`md-focus-ring`). Im Windows-Kontrastmodus (`forced-colors`) erhalten Buttons
und Textfelder einen sichtbaren Rand.

Bewusst nicht gebaut (siehe Vorschlag unten): Navigation, Dialoge, Listen,
Schalter, Snackbar, FAB, Segmented Button, unbestimmte Fortschrittsanzeigen.
Zahlenfeld, großer Button und kreisförmige Fortschrittsanzeige kamen mit C-02.
Eigene Festlegungen dabei: Timer-Ring 256 px mit Dicke 12 px; Abstand Indikator–Spur
gleich der Dicke (Verhältnis der Tokens 4/4); Zahlenfeld ohne Plus/Minus-Knöpfe
(Ziffern-Tastatur, Pfeiltasten).

### Vorschlag für Folgetasks

| Folgetask | voraussichtlich benötigt |
| --- | --- |
| C-02 Timer-UI | Zahlenfeld oder Zeitwahl für Training/Pause (React Aria `NumberField`), großer Start/Pause-Button (Größe large/xlarge) oder FAB, Fortschrittsanzeige (kreisförmig), Button-Gruppe bzw. Segmented Button, ggf. Schalter (Ton an/aus) |
| C-03 Passkey-UI | Liste mit Aktionen (Passkeys anzeigen, löschen), Dialog (Löschen bestätigen, zweiten Passkey anfordern), Snackbar bzw. Statusmeldung, Fortschrittsanzeige während WebAuthn |
| C-04 Workout-UI | Liste/Card klickbar, Auswahl (Select/Menu für Typ KRAFT/CALISTHENICS), Segmented Button oder Schalter für Sichtbarkeit, Chips, Datum/Uhrzeit-Wahl, Navigation (Navigation Bar mobil, Navigation Rail ab 840 px), Top App Bar, Dialog |

## 4. Schrift und Icons (selbst gehostet, E2)

| Datei/Paket | Lizenz | Einbindung |
| --- | --- | --- |
| Roboto (variabel, Achse `wght`), npm `@fontsource-variable/roboto` 5.3 | SIL Open Font License 1.1 (Lizenztext in `node_modules/@fontsource-variable/roboto/LICENSE`, Copyright The Roboto Project Authors) | `woff2`-Dateien werden beim Build nach `dist/assets/` kopiert und vom eigenen Server ausgeliefert. Der Browser lädt nur benötigte Zeichensätze (`unicode-range`). |
| Material Symbols Rounded, Gewicht 400, npm `@material-symbols/svg-400` 0.49 | Apache License 2.0 (Google) | Nur die in `src/components/ui/icons.ts` gelisteten SVGs werden beim Build in das JavaScript eingebettet. |

Der Schrift-Name `md.ref.typeface.brand`/`plain` = Roboto stammt aus den
Token-Dateien (Kontext `font: static`, `platform: web`). Roboto Flex ist laut
m3.material.io (Typography) "noch nicht Teil der M3-Typo-Skala" und wird
deshalb nicht verwendet.

## 5. Tests

- Vitest: `src/theme/farbschema.test.ts` (Generator-Abgleich, Rollen,
  Kontraste), `src/components/ui/ui.test.tsx` (Bedienung, ARIA).
- Playwright: `e2e/visuell.spec.ts` macht Screenshots der Galerie
  (`galerie.html`) je Abschnitt in hell und dunkel, dazu Fokuszustände und
  Startseite. Diese Bildvergleiche (Tag `@visuell`) laufen nur in Chromium
  (Projekt `visuell-chromium`) gegen den Test-Build (`vite build --mode test`,
  E24). Firefox, WebKit und Mobil-Emulation prüfen nur die Funktion, nicht das
  Aussehen (Aufteilung siehe README, Abschnitt "Produktions-Build und
  Test-Build"). Referenzbilder liegen unter `e2e/visuell.spec.ts-snapshots/`,
  nur für Chromium unter Linux. Neu erzeugen nach gewollten Änderungen:
  `npx playwright test --project=visuell-chromium --update-snapshots`.
- Die Bilder hängen von Betriebssystem und Schriftdarstellung ab. Auf anderen
  Rechnern oder in einer CI müssen sie dort erzeugt werden.

## 6. Offen

- Barrierefreiheit ist nur automatisch geprüft: Kontraste, Namen und
  Beschreibungen, Tastaturbedienung in Unit-Tests. Kein Test mit echtem
  Screenreader, keine Prüfung mit axe.
- Die Komponenten sind nicht in Safari/WebKit geprüft.
- Neuere Ausgaben der Token-Dateien können Werte ändern. Bei einem Update die
  Quellen in Abschnitt 1 neu abgleichen.
