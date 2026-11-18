import babelParser from '@babel/eslint-parser';

/*
 * ESLint prüft bewusst nur eine Regel (Entscheidung E24): Die
 * Komponentengalerie (src/galerie/) darf nur die Produktionskomponenten
 * nutzen, damit sie nicht vom ausgelieferten Code abweicht. Kein
 * allgemeiner Regelsatz.
 *
 * Parser: @babel/eslint-parser mit den Babel-Syntax-Plugins für TypeScript
 * und JSX. typescript-eslint unterstützt TypeScript 7 nicht (Peer
 * `typescript <6.1`, TypeScript 7 hat keine JavaScript-API). Für eine
 * Import-Regel reicht ein Parser ohne Typinformationen.
 */

const parserFuer = (plugins) => ({
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: { babelrc: false, configFile: false, parserOpts: { plugins } },
  },
});

// Muster fuer verbotene Importe in src/galerie/: alles ausser
// - React ('react', 'react-dom/client'),
// - Produktionskomponenten unter src/components/ ('../components', '../components/…'),
//   keine Testdateien (*.test.*),
// - die globalen Stile der App ('../styles'),
// - Dateien der Galerie selbst ('./…', ohne den Ordner zu verlassen).
const VERBOTEN_IN_GALERIE = String.raw`^(?!(react|react-dom/client|\.\./styles)$)(?!\.\./components(/(?!.*\.\.)(?!.*\.test(\.|$))[^]*)?$)(?!\./(?!.*\.\.))`;

export default [
  { ignores: ['dist/', 'dist-*/', 'dev-dist/', 'coverage/', 'playwright-report/', 'test-results/'] },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { sourceType: 'module' },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { sourceType: 'module', ...parserFuer(['typescript']) },
  },
  {
    files: ['**/*.tsx'],
    languageOptions: { sourceType: 'module', ...parserFuer(['typescript', 'jsx']) },
  },
  {
    files: ['src/galerie/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: VERBOTEN_IN_GALERIE,
              message:
                'Die Galerie darf nur Produktionskomponenten (../components/…, keine Tests), ../styles, React und eigene Dateien importieren (E24).',
            },
          ],
        },
      ],
    },
  },
];
