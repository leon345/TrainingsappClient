import { BeispielButton } from './components/BeispielButton';

/**
 * Anwendungsrahmen. Fachliche Ansichten (Timer, Passkeys, Workouts)
 * folgen in eigenen Tasks.
 */
export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title md-typescale-title-large">Trainingsapp</h1>
      </header>
      <main className="app__main">
        <section className="app__section" aria-labelledby="grundgeruest-titel">
          <h2 id="grundgeruest-titel" className="md-typescale-headline-small">
            Grundgerüst
          </h2>
          <p>React, TypeScript, Vite und React Aria Components sind eingerichtet.</p>
          <BeispielButton />
        </section>
      </main>
    </div>
  );
}
