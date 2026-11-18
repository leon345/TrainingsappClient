import { TimerAnsicht } from './timer/TimerAnsicht';

/**
 * Anwendungsrahmen. Startseite ist der Intervalltimer (C-02). Weitere
 * Ansichten (Passkeys, Workouts) folgen in eigenen Tasks; bis dahin gibt es
 * kein Routing.
 */
export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title md-typescale-title-large">Trainingsapp</h1>
      </header>
      <main className="app__main">
        <TimerAnsicht />
      </main>
    </div>
  );
}
