# Dependency-Audit Client (C-14)

Stand: 18.11.2026. Basis: `task/C-06-material-design` (e3edbf5), Lockfile
unverändert. Node v22.22.1, npm 9.2.0.

## Ergebnis in Kürze

| Prüfung | Kritisch | Hoch | Moderat | Niedrig | Gesamt |
| --- | --- | --- | --- | --- | --- |
| `npm audit` | 0 | 12 | 2 | 0 | 14 |
| `npm audit --omit=dev` (ausgelieferter Code) | 0 | 0 | 0 | 0 | 0 |

- **Im ausgelieferten Code ist keine Lücke offen.** Alle 14 Meldungen liegen
  in devDependencies (Vite, Vitest, `@vitejs/plugin-react`,
  `vite-plugin-pwa`/`workbox-build`).
- Gegenprobe am Build: In `dist/` (Bundle, `sw.js`, Workbox-Laufzeit
  `workbox-*.js`, `registerSW.js`) kommt keines der Pakete `picomatch`,
  `minimatch`, `glob`, `tinyglobby`, `fdir`, `@rollup/pluginutils` oder
  `workbox-build` vor (`grep -rlE` über `dist/`: kein Treffer). Der Service
  Worker enthält nur die Workbox-Laufzeit, nicht `workbox-build`.
- Alle Pakete stehen bereits auf der neuesten Version im erlaubten Bereich
  (`npm outdated`: nur `@types/node` 24 → 26, Major, ohne Bezug zum Audit).
  Ein gezieltes Update ohne Breaking Change ist daher nicht möglich.
- Die von `npm audit fix --force` vorgeschlagenen "Fixes" sind
  **Major-Downgrades** (vite 6.2.7, vitest 3.1.4, `@vitejs/plugin-react`
  5.2.0, `vite-plugin-pwa` 1.1.0). Sie wurden nicht durchgeführt.
  `npm audit fix --dry-run` bricht mit npm 9.2.0 ab
  (`Cannot read properties of null (reading 'edgesOut')`).

## Die drei zugrunde liegenden Advisories

| Advisory | Paket, Version im Lockfile | Betroffen / behoben ab | Angriffsweg |
| --- | --- | --- | --- |
| [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (hoch, CVSS 7.5, ReDoS) | `picomatch` 4.0.7 | `<= 4.0.7` / **kein Fix veröffentlicht** (4.0.7 ist `latest`) | Angreifer muss das **Glob-Muster** liefern (z. B. `+(*)`). |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (moderat, DoS) | `minimatch` 10.2.6 (über `glob` 11.1.0) | `>=7.0.0 <11.0.1` / 11.0.1 | Angreifer muss das **Glob-Muster** liefern (`**/../`-Vervielfachung). |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) (moderat) | `glob` 11.1.0 (über `workbox-build` 7.4.1) | `9.0.0 – 14.0.1` / 14.0.2 | Nur wenn ein Aufrufer die Suche per `AbortSignal` begrenzt: nach Abbruch läuft sie weiter. |

`minimatch` 5.1.9 (über `ejs` → `jake` → `filelist`) liegt außerhalb des
betroffenen Bereichs.

## Tabelle je Lücke

Alle Einträge: Pfad **dev**, nicht im Build-Output.

| # | Lücke (Advisory) | Paket | Schweregrad | Herkunft | dev / ausgeliefert | Bewertung | Entscheidung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GHSA-fc5q-39xc-vjpf | `picomatch` 4.0.7 | hoch | direkt von `vite`, `vitest`, `tinyglobby`, `fdir`, `@rollup/pluginutils` | dev | Muster kommen nur aus eigener Konfiguration und eigenem Quelltext (`vite.config.ts`, `workbox.globPatterns`, Vite-Standardmuster wie `server.fs.deny`, `import.meta.glob`), keines enthält Extglobs. Kein Weg, über den Dritte ein Muster einschleusen. Dev-Server lauscht nur auf `localhost` (kein `server.host`). | Belassen: kein Fix verfügbar. Bei neuer `picomatch`-Version erneut prüfen. |
| 2 | über #1 | `fdir` 6.5.0 | hoch | `tinyglobby` | dev | wie #1 | Belassen (folgt #1) |
| 3 | über #1, #2 | `tinyglobby` 0.2.17 | hoch | `vite`, `vitest`, `vite-plugin-pwa` | dev | wie #1 | Belassen (folgt #1) |
| 4 | über #1 | `@rollup/pluginutils` 5.5.1 | hoch | `@rollup/plugin-*` in `workbox-build` | dev | wie #1, nur beim Erzeugen des Service Workers im Build | Belassen (folgt #1) |
| 5 | über #4 | `@rollup/plugin-babel` 6.1.0 | hoch | `workbox-build` | dev | wie #4 | Belassen (folgt #1) |
| 6 | über #4 | `@rollup/plugin-node-resolve` 16.0.3 | hoch | `workbox-build` | dev | wie #4 | Belassen (folgt #1) |
| 7 | über #4 | `@rollup/plugin-replace` 6.0.3 | hoch | `workbox-build` | dev | wie #4 | Belassen (folgt #1) |
| 8 | über #1, #3 | `vite` 8.3.8 | hoch | direkt (devDependency) | dev | wie #1 | Belassen (folgt #1); Vorschlag von npm wäre Downgrade auf 6.2.7 |
| 9 | über #8 | `@vitejs/plugin-react` 6.3.0 | hoch | direkt (devDependency) | dev | wie #1 | Belassen (folgt #1); npm-Vorschlag: Downgrade 5.2.0 |
| 10 | über #1, #3, #8 | `vitest` 5.1.1 | hoch | direkt (devDependency) | dev | wie #1, nur Testlauf | Belassen (folgt #1); npm-Vorschlag: Downgrade 3.1.4 |
| 11 | über #3, #12 | `vite-plugin-pwa` 2.0.0 | hoch | direkt (devDependency) | dev | Nur Build. Ausgeliefert wird lediglich das erzeugte `sw.js` mit Workbox-Laufzeit, frei von den betroffenen Paketen. | Belassen (folgt #1, #13, #14); npm-Vorschlag: Downgrade 1.1.0 |
| 12 | über #4–#7, #13 | `workbox-build` 7.4.1 | hoch | `vite-plugin-pwa` | dev | wie #11 | Belassen (folgt #1, #13) |
| 13 | GHSA-3g3m-2fjr-6pw4 | `glob` 11.1.0 | moderat | `workbox-build` | dev | `workbox-build` ruft nur `globSync(muster, { cwd, follow, ignore })` auf, ohne `AbortSignal`. Der Angriffsweg ist nicht erreichbar. | Belassen; Fix nur mit Major-Sprung, siehe unten |
| 14 | GHSA-g3hv-75wg-m249 | `minimatch` 10.2.6 | moderat | `glob` 11.1.0 | dev | Muster stammen aus `workbox.globPatterns` und den `globIgnores`-Standardwerten von `vite-plugin-pwa`, also aus eigener Konfiguration. | Belassen; Fix nur mit Major-Sprung, siehe unten |

## Nur mit Major-Sprung behebbar: `glob` 11 → 14 (Lücken #13, #14)

`workbox-build` 7.4.1 (neueste Version) verlangt `glob ^11.0.1`. Ein Fix ginge
nur über einen Override:

```json
"overrides": { "workbox-build": { "glob": "^14.0.2" } }
```

- **Getestet, aber nicht übernommen:** Mit dem Override wurde `glob` 14.0.6
  mit `minimatch` 11.0.9 installiert. `npm audit` meldete dann 12 hohe und 0
  moderate Lücken (#13 und #14 entfallen). Der Build lief durch, und alle
  25 Dateien in `dist/` waren **byte-identisch** zum Build ohne Override
  (SHA-256-Vergleich, `precache 29 entries`).
- **Risiko:** `glob` 12–14 sind Major-Versionen. Für `globSync` relevant ist
  v14: Muster werden nach `minimatch` 11 ausgewertet ("closer to Bash in some
  edge cases"), und `ignore`-Muster mit führendem `/` beginnen jetzt an der
  Wurzel. Workbox ist gegen `glob` 14 nicht getestet. Ein stiller Fehler zeigt
  sich als fehlende oder zusätzliche Precache-Einträge im Service Worker, nicht
  als Build-Fehler. Ein Override muss außerdem bei jedem Update von
  `workbox-build` erneut geprüft werden.
- **Aufwand:** gering (eine Zeile in `package.json`, Lockfile). Nötig wäre ein
  Test, der die Precache-Liste in `sw.js` prüft.
- **Nutzen:** gering, weil der Angriffsweg in diesem Projekt nicht erreichbar
  ist und die hohen Meldungen (#1–#12) bleiben.
- **Entscheidung offen** (Orchestrator). Empfehlung: nicht übernehmen, sondern
  auf eine `workbox-build`-Version mit `glob` ≥ 14.0.2 warten.

## Erneut prüfen

- Sobald `picomatch` > 4.0.7 oder `workbox-build` > 7.4.1 erscheint.
- Wenn sich die Konfiguration so ändert, dass Glob-Muster aus fremden Eingaben
  kommen, oder wenn der Dev-Server im Netz erreichbar gemacht wird
  (`server.host`).
