# Arbeitsregeln für dieses Repo

- Maßgeblich ist `SPEC.md`. Neue Vorgaben des Nutzers dort nachtragen.
- Kein Build-Schritt, keine Frameworks, keine externen Libraries. Nur Vanilla HTML/CSS/JS (ES-Module).
- Design: minimalistisch, hochwertig, neutrale Farben, Hell- und Dunkelmodus. Farben/Radien/Schatten nur über die Variablen in `styles.css`. Marius = blauer Farbakzent (`--marius`), Agnessa = pinker Farbakzent (`--agnessa`).
- Nach jeder Änderung an App-Dateien `APP_VERSION` in `sw.js` erhöhen, sonst erhalten installierte Geräte kein Update. Neue Dateien in `SHELL_FILES` aufnehmen.
- Neue Karten (meist als `.txt`-Dateien aus `docs/KARTEN-VORLAGE.md`): nächste freie ID je Rechtsgebiet vergeben (`strafrecht-0004` …), als `content/<gebiet>/<id>.json` speichern, inhaltlich stichprobenartig prüfen (Rechtslage korrekt? Erste Antwort tatsächlich richtig? Erklärung nennt einen Grund/eine Norm?), dann `node tools/build-index.mjs` und `node tools/validate.mjs` (muss grün sein). `content/index.json` nie von Hand bearbeiten.
- `content/_inbox/`: Dateien, die der Nutzer dort über GitHub hochlädt, zu Beginn der Sitzung verarbeiten (siehe README dort) – einsortieren, validieren, aus der Inbox löschen.
- Von den Nutzern in der App selbst angelegte Karten liegen NICHT unter `content/`, sondern nur in der lokalen Datenbank und im gemeinsamen Gist (siehe SPEC.md Abschnitt 8). An diesen Karten ändert eine Claude-Code-Sitzung nichts.
- Seit dem Flag-Feature (SPEC.md Abschnitt 5.4/5.5) gibt es zwei weitere IndexedDB-Stores (`flags`, `cardEdits`) und zwei weitere Felder im gemeinsamen Gist (`flags`, `cardEdits`), die genauso wie die Kartenstufen per Zeitstempel zusammengeführt werden. Jede Kartenliste (Warteschlangen, Zählungen) läuft zentral durch `store.applyOverridesAndFilter` – dort landen künftige Änderungen an der Sichtbarkeits-/Korrekturlogik, nicht dupliziert in `cards.js`/`quiz.js`.
- Vor dem Commit die App lokal im Browser durchspielen (idealerweise mit einem Browser-Testwerkzeug bei iPhone- und Laptop-Breite, falls in der jeweiligen Umgebung verfügbar; sonst zumindest über einen lokalen HTTP-Server und sorgfältige Codedurchsicht).
- Der Nutzer ist Jurist, kein Programmierer: Anleitungen Schritt für Schritt, ohne Fachkürzel, auf Deutsch.
- Ablauf: Änderungen direkt auf dem aktuellen Branch committen, wenn nicht ausdrücklich ein Pull Request gewünscht ist.
