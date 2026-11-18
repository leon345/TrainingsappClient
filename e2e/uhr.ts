import type { Page } from '@playwright/test';

/*
 * Uhr in E2E-Tests vollständig vom Test gesteuert.
 *
 * `page.clock.install()` ersetzt Date und Timer, lässt die Zeit aber mit der
 * echten Zeit weiterlaufen. Zwischen zwei Schritten des Tests (Klick,
 * `runFor`, Prüfung) vergeht so auch Zeit in der Seite; unter Last mehr als
 * eine Sekunde, und eine exakte Anzeige wie "00:09" ist dann schon "00:08".
 * Deshalb: nach dem Laden anhalten und nur noch mit `runFor`/`fastForward`
 * vorstellen. Beim Laden selbst läuft die Uhr, damit die Seite normal startet
 * (Empfehlung der Playwright-Dokumentation zu `clock.pauseAt`).
 */

/**
 * Abstand des Haltepunkts zur Installationszeit. `pauseAt` darf nicht in der
 * Vergangenheit der Seitenuhr liegen. Bis zum Anhalten läuft sie nur mit der
 * echten Zeit, und ein Test darf höchstens 30 s dauern (Standard-Timeout);
 * 5 Minuten liegen also sicher in der Zukunft, auch unter Last. Die Tests
 * prüfen nur Zeitabstände, keine absolute Uhrzeit.
 */
const VORLAUF_MS = 5 * 60_000;

/**
 * Hält die Uhr der Seite an. Danach vergeht Zeit nur noch per runFor/fastForward.
 * `installiertUm` ist die Zeit aus `page.clock.install({ time })`.
 */
export async function halteUhrAn(page: Page, installiertUm: Date): Promise<void> {
  await page.clock.pauseAt(installiertUm.getTime() + VORLAUF_MS);
}
