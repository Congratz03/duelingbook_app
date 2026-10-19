# Duelingbook Tablet-App – Anleitung

Private Wrapper-App: öffnet duelingbook.com im Vollbild (Querformat) auf dem Android-Tablet.
Nur für den eigenen Gebrauch – nicht im Play Store veröffentlichen.

## APK bauen (einmalig, ca. 15 Min.)

1. **Android Studio** installieren: https://developer.android.com/studio
2. ZIP entpacken → in Android Studio **File → Open** → den Ordner `duelingbook-app` wählen.
3. Warten, bis „Gradle Sync“ fertig ist (lädt beim ersten Mal SDK und Gradle herunter).
   Fragt Studio nach dem Gradle-Wrapper oder einem Update: einfach bestätigen.
4. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
   Die Datei liegt danach unter `app/build/outputs/apk/debug/app-debug.apk`.

## Aufs Tablet bringen

**Variante A – per USB (am einfachsten):**
Auf dem Tablet *Einstellungen → Über das Tablet → 7× auf „Build-Nummer“ tippen* → Entwickleroptionen →
**USB-Debugging** an. Tablet anschließen, in Android Studio oben das Gerät wählen und auf ▶ (Run) klicken.

**Variante B – APK-Datei:**
`app-debug.apk` aufs Tablet kopieren (Google Drive, USB, Mail), antippen, Installation aus
„unbekannten Quellen“ für die jeweilige App erlauben.

## Bedienung

| Geste | Wirkung |
|---|---|
| Tippen | normaler Linksklick |
| **Lange drücken** (~0,35 s) | Maus-drüberfahren → Kartenvorschau, ohne zu klicken |
| Halten + Finger gleiten lassen | Vorschau wandert über die Karten mit |
| Zwei Finger auseinander/zusammen | Zoom |
| Vom Rand wischen | System-Leisten kurz einblenden |
| Zurück-Taste | vorherige Seite bzw. App schließen |

Login bleibt gespeichert, der Bildschirm geht während des Spielens nicht aus,
Deck-Import per Datei-Upload funktioniert.

## Anpassen

- **Halte-Dauer** für die Vorschau: `app/src/main/assets/touch.js` → `HOLD_MS`
- **Hoch- statt Querformat erlauben**: in `AndroidManifest.xml` `sensorLandscape` → `fullSensor`
- **Startseite**: `MainActivity.kt` → `START_URL`
