/*
 * Icon-Satz: Material Symbols Rounded, Gewicht 400, als SVG aus dem npm-Paket
 * `@material-symbols/svg-400` (Apache-2.0). Die Dateien werden beim Build
 * eingebettet, zur Laufzeit gibt es keine Anfrage an fremde Hosts (E2).
 *
 * Neues Icon: Datei unter node_modules/@material-symbols/svg-400/rounded/
 * suchen (Name wie auf fonts.google.com/icons, gefüllte Variante mit "-fill")
 * und hier ergänzen.
 */
import add from '@material-symbols/svg-400/rounded/add.svg?raw';
import arrowBack from '@material-symbols/svg-400/rounded/arrow_back.svg?raw';
import check from '@material-symbols/svg-400/rounded/check.svg?raw';
import close from '@material-symbols/svg-400/rounded/close.svg?raw';
import deleteIcon from '@material-symbols/svg-400/rounded/delete.svg?raw';
import edit from '@material-symbols/svg-400/rounded/edit.svg?raw';
import fitnessCenter from '@material-symbols/svg-400/rounded/fitness_center.svg?raw';
import key from '@material-symbols/svg-400/rounded/key.svg?raw';
import moreVert from '@material-symbols/svg-400/rounded/more_vert.svg?raw';
import pauseFill from '@material-symbols/svg-400/rounded/pause-fill.svg?raw';
import playArrowFill from '@material-symbols/svg-400/rounded/play_arrow-fill.svg?raw';
import restartAlt from '@material-symbols/svg-400/rounded/restart_alt.svg?raw';
import settings from '@material-symbols/svg-400/rounded/settings.svg?raw';
import stopFill from '@material-symbols/svg-400/rounded/stop-fill.svg?raw';
import timer from '@material-symbols/svg-400/rounded/timer.svg?raw';
import visibility from '@material-symbols/svg-400/rounded/visibility.svg?raw';
import visibilityOff from '@material-symbols/svg-400/rounded/visibility_off.svg?raw';

const QUELLEN = {
  add,
  arrow_back: arrowBack,
  check,
  close,
  delete: deleteIcon,
  edit,
  fitness_center: fitnessCenter,
  key,
  more_vert: moreVert,
  pause: pauseFill,
  play_arrow: playArrowFill,
  restart_alt: restartAlt,
  settings,
  stop: stopFill,
  timer,
  visibility,
  visibility_off: visibilityOff,
} as const;

export type IconName = keyof typeof QUELLEN;

export const ICON_NAMEN = Object.keys(QUELLEN) as IconName[];

/** Material-Symbols-SVGs nutzen alle diese viewBox. */
export const ICON_VIEWBOX = '0 -960 960 960';

/** Liest das `d`-Attribut des einzigen Pfads einer Material-Symbols-SVG. */
export function pfadAusSvg(svg: string): string {
  const treffer = /<path[^>]*\sd="([^"]+)"/.exec(svg);
  if (!treffer?.[1]) {
    throw new Error('SVG enthält keinen Pfad');
  }
  return treffer[1];
}

const PFADE = Object.fromEntries(
  Object.entries(QUELLEN).map(([name, svg]) => [name, pfadAusSvg(svg)]),
) as Record<IconName, string>;

export function iconPfad(name: IconName): string {
  return PFADE[name];
}
