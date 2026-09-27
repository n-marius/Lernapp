# Eingang für neue Karten

Hierher lädst du fertige `.txt`-Dateien hoch, die eine KI mit
`docs/KARTEN-VORLAGE.md` erzeugt hat – ganz ohne den Umweg über einen
Dateianhang im Chat mit Claude Code (dort sind nur 5 Dateien pro Nachricht
möglich).

## So lädst du Dateien hoch

1. Dieses Repo im Browser öffnen.
2. In den Ordner `content/_inbox` wechseln.
3. Oben rechts auf **Add file → Upload files** klicken.
4. Eine oder mehrere `.txt`-Dateien hineinziehen.
5. Unten auf **Commit changes** klicken (Branch beibehalten).

Das war's. Beliebig viele Dateien, beliebig oft – kein Limit wie im Chat.

## Wie es weitergeht

In der nächsten Claude-Code-Sitzung reicht der Satz „Bitte den Inbox-Ordner
verarbeiten“ (oder es geschieht automatisch, wenn hier Dateien liegen). Jede
Datei wird geprüft (Format, Inhalt, Rechtsgebiet), bekommt eine fortlaufende
Nummer, wird nach `content/<gebiet>/<id>.json` verschoben, und hier im Eingang
wieder gelöscht. Anschließend wird der Index neu gebaut
(`node tools/build-index.mjs`) und geprüft (`node tools/validate.mjs`).

Dieser Ordner sollte also im Normalfall leer sein – Inhalt hier bedeutet
„wartet auf Verarbeitung“.
