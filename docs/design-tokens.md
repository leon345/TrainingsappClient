# Material Design 3 Expressive – Design-Tokens & Theme

Dieses Dokument beschreibt das Design-System von **TrainingsappClient** auf Basis von **@mui/material** (Standard-Package) und **@material/material-color-utilities** (Material Design 3 Expressive, Spec `2025`).

## 1. Quellfarbe & Dynamisches Farbschema

- **Quellfarbe (Seed):** `#006A60` (definiert als `QUELLFARBE` in [`src/theme/farbschema.ts`](../src/theme/farbschema.ts)).
- **Generator:** `SchemeExpressive(Hct.fromInt(argbFromHex(QUELLFARBE)), isDark, 0, '2025')` in Verbindung mit `MaterialDynamicColors` aus `@material/material-color-utilities`.
- **Farbmodi:** Vollständige Hell- und Dunkelpaletten (`hell`, `dunkel`), eingebunden über MUI `colorSchemes` mit `cssVariables: { colorSchemeSelector: 'media' }` in [`src/theme/theme.ts`](../src/theme/theme.ts). Das Farbschema folgt automatisch `prefers-color-scheme` ohne Laufzeit-Flicker.
- **Abgedeckte M3-Rollen:** `primary`, `secondary`, `tertiary` (MUI `info`), `error`, `surface`, `surfaceContainerLowest` bis `surfaceContainerHighest`, `onSurface`, `onSurfaceVariant`, `outline`, `outlineVariant`, `inverseSurface`, `inverseOnSurface`, `inversePrimary`.

## 2. Typografie (selbst gehostet)

- **Schriftfamilie:** `'Roboto Variable', 'Roboto', system-ui, -apple-system, sans-serif`
- **Einbindung:** Lokal gebündelt über `@fontsource-variable/roboto` (`.woff2` im eigenen Build unter `dist/assets/`). Es werden **keine externen CDNs** (wie Google Fonts) geladen.
- **Expressive Hierarchie:**
  - `h1`: `2.25rem`, Gewicht `700`, Zeilenhöhe `1.15`, enges Tracking (`-0.02em`)
  - `h2`: `1.75rem`, Gewicht `700`, Zeilenhöhe `1.2`
  - `h3`: `1.375rem`, Gewicht `600`, Zeilenhöhe `1.28`
  - `button`: Gewicht `600`, ohne erzwungene Großschreibung (`textTransform: 'none'`)
  - Zeitdauern im Timer nutzen `font-variant-numeric: tabular-nums`, damit Ziffern beim Herunterzählen nicht springen.

## 3. Formen, Layout & Barrierefreiheit (WCAG 2.1 AA)

- **Expressive Rundungen:**
  - Basis (`shape.borderRadius`): `20px`
  - Karten (`MuiCard`): `24px`
  - Dialoge (`MuiDialog`): `28px`
  - Eingabefelder (`MuiOutlinedInput`) & Hinweise (`Alert`): `16px`
  - Chips (`MuiChip`): `12px`
  - Buttons & aktive Navigations-Elemente: Pill-Form (`9999px`)
- **Responsive Breakpoint (`md: 840px`):** Entspricht der Material-3-Window-Size-Class *Expanded*.
  - `< 840px` (Mobil): Kompakter `AppBar` oben + feste `BottomNavigation` unten (`72px`).
  - `>= 840px` (Desktop): Persistente linke Navigationsleiste (`248px`).
- **Touch-Ziele & Tastaturfokus:**
  - `MuiButton`, `MuiIconButton`, `MuiBottomNavigationAction` und `ListItemButton` haben eine Mindesthöhe bzw. -breite von `48px`.
  - Sichtbarer `:focus-visible`-Rahmen (`3px solid currentColor`, `outlineOffset: 2px`) global über `MuiCssBaseline`.

## 4. Eingesetzte Standard-Packages & Lizenzen

Alle UI-Komponenten, Icons und Schriften werden lokal aus Standard-Packages gebündelt:

| Paket | Zweck | Lizenz |
| --- | --- | --- |
| `@mui/material` | Material-UI-Komponentenbibliothek & Theming | MIT |
| `@mui/icons-material` | Lokal gebündelte Material-SVG-Icons | MIT |
| `@emotion/react`, `@emotion/styled` | Styling-Engine für MUI | MIT |
| `@material/material-color-utilities` | Material-3-Expressive-Farbschema-Generator | Apache-2.0 |
| `@fontsource-variable/roboto` | Selbst gehostete Roboto-Variable-Schriftdateien | Apache-2.0 |
| `react-router` | Client-Routing (`BrowserRouter`) | MIT |
| `openapi-fetch`, `openapi-typescript` | Typsicherer OpenAPI-Client & Schema-Typgenerierung | MIT |

## 5. Visuelle Prüfung

Visuelle Screenshot-Regressionstests laufen gemäß Nutzerentscheid C ausschließlich im Playwright-Projekt `visuell-chromium` (Hell- und Dunkelschema auf Desktop `1280×800` und Mobil `360×800`). Funktionale E2E-Tests laufen in allen vier Browser-Projekten (`chromium`, `firefox`, `webkit`, `mobile`) gegen den Produktions-Build.
