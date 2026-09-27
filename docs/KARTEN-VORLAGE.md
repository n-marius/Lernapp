# Vorlage: Viele neue Karteikarten auf einmal erzeugen

Diese Vorlage ist für einen **separaten, normalen Chat** gedacht (nicht Claude
Code) – zum Beispiel claude.ai in deinem Browser. Alles ab der Linie unten in
einen neuen Chat kopieren, im Abschnitt **Auftrag** Rechtsgebiet, Anzahl und
ggf. Themenwunsch eintragen und abschicken. Die erzeugten `.txt`-Dateien lädst
du anschließend entweder als Anhang in einer Claude-Code-Sitzung hoch mit dem
Satz „Bitte diese Karten in die App aufnehmen“, oder direkt in
`content/_inbox/` im Repo (siehe `content/_inbox/README.md` – das geht ganz
ohne Programmierkenntnisse, nur über die GitHub-Webseite).

---

Du erstellst Karteikarten für Staatsexamens-Kandidaten im deutschen Recht
(Erstes Juristisches Staatsexamen).

## Auftrag

- Rechtsgebiet (genau eines): zivilgericht | strafrecht | rechtsanwalt | verwaltungsrecht
  (zivilgericht = Zivilrecht, rechtsanwalt = Anwalts-/Berufsrecht)
- Thema (optional, sonst wählst du frei aus dem Rechtsgebiet):
- Anzahl Karten: 10

## Ausgabe

- Jede Karte wird als **eigene Datei** ausgegeben: `.txt` mit reinem
  JSON-Inhalt (kein Codeblock, kein Begleittext in der Datei).
- Dateiname: `<gebiet>_<kurzes-thema>.txt`, z. B. `strafrecht_notwehr.txt`.
- Vor der Ausgabe das JSON technisch prüfen (gültiges JSON, alle Felder vorhanden).
- Im Chat nur knappe Angaben: Anzahl Karten, Rechtsgebiete, ggf. Unsicherheiten.

## Format (pro Karte eine Datei)

```json
{
  "gebiet": "strafrecht",
  "frage": "Was unterscheidet Raub (§ 249 StGB) von räuberischer Erpressung (§ 255 StGB)?",
  "antworten": [
    "Beim Raub nimmt der Täter die Sache selbst weg, bei der räuberischen Erpressung wirkt das Opfer durch eine Vermögensverfügung mit",
    "Raub setzt eine Waffe voraus, räuberische Erpressung nicht",
    "Räuberische Erpressung ist kein Vermögensdelikt",
    "Beide Tatbestände unterscheiden sich nur in der Strafhöhe"
  ],
  "erklaerung": "Kurze, sachliche Begründung mit Normverweis. Zwei bis vier Sätze reichen."
}
```

**Wichtig zum Feld `antworten`:** Das **erste** Element (Index 0) ist immer
die richtige Antwort. Die App mischt beim Anzeigen selbst und markiert die
richtige Antwort unabhängig von der Reihenfolge – du musst dich beim
Schreiben nur daran halten, dass die richtige Antwort an erster Stelle steht.

## Technische Regeln

- `gebiet`: genau eines von `zivilgericht`, `strafrecht`, `rechtsanwalt`, `verwaltungsrecht`.
- `frage`: ein präziser, examensnaher Sachverhalt oder eine Wissensfrage. Kein Fließtext-Sachverhalt über mehrere Absätze – die Frage muss auf eine Bildschirmzeile bis wenige Zeilen passen.
- `antworten`: **genau 4** Einträge, Index 0 = richtige Antwort, die anderen drei plausibel, aber eindeutig falsch (keine Wortspiele, keine Trivial-Ablenker).
- `erklaerung`: 2–4 Sätze, mit Normverweis wo möglich, erklärt **warum** die Antwort richtig ist (nicht nur eine Wiederholung der Antwort).
- Ausschließlich inhaltlich korrektes, aktuelles deutsches Recht. Bei Unsicherheiten (z. B. bei umstrittenen Meinungsstreiten) die herrschende Meinung wählen und dies im Chat kurz erwähnen.
- Sprache: klares, examenstypisches Deutsch, keine Umgangssprache.

## Kontrolle vor der Ausgabe

- Gültiges JSON?
- `gebiet` eines der vier erlaubten Werte?
- Genau 4 Antworten, Index 0 richtig?
- Erklärung nennt eine Norm oder einen klaren Grund?
- Frage inhaltlich korrekt und examensnah?

## Wie es weitergeht (nur zu deiner Information, nicht Teil des Auftrags)

In der nächsten Claude-Code-Sitzung vergibt der Assistent die nächste freie
Nummer je Rechtsgebiet (z. B. `strafrecht-0004`), legt die Datei unter
`content/<gebiet>/` ab, prüft den Inhalt stichprobenartig, baut den Index neu
(`node tools/build-index.mjs`) und validiert ihn (`node tools/validate.mjs`).
