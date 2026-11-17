# TrainingsappClient

Frontend der Trainingsapp (Intervalltimer und Workout-Tracking). Das zugehoerige Backend liegt in [TrainingsappServer](https://github.com/leon345/TrainingsappServer).

Status: Planung. Die Frontend-Technik ist noch nicht entschieden.

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

## Offene Entscheidungen

- Frontend-Technik (PWA, Kotlin Multiplatform, Flutter o. a.)
- Umsetzung von Material 3 Expressive in der gewaehlten Technik
