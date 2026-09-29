# Formatvorlage: Karte im Format „Begriffe“

Reine Formatvorlage für Karten, deren Antwort eine Abfolge oder Auflistung von
Begriffen ist. Wann das Format zu verwenden ist und wie die Antworten
inhaltlich aufzubauen sind, regelt die übrige Kartenvorlage
(`docs/KARTEN-VORLAGE.md`) bzw. der jeweilige Auftrag.

Ausgabe wie bei allen Karten: pro Karte eine `.txt`-Datei mit reinem JSON
(kein Codeblock, kein Begleittext), Dateiname `<gebiet>_<kurzes-thema>.txt`.

## Format (pro Karte eine Datei)

```json
{
  "gebiet": "zivilgericht",
  "prio": "normal",
  "typ": "begriffe",
  "reihenfolge": true,
  "frage": "…",
  "antworten": [
    "Begriff 1 (an richtiger Stelle)",
    "Begriff 2",
    "Begriff 3"
  ],
  "falsche": [
    "Falscher Begriff A",
    "Falscher Begriff B"
  ],
  "erklaerung": "…"
}
```

## Felder

- `gebiet`, `prio`, `frage`, `erklaerung`: wie bei den übrigen Karten
  (`gebiet`: `zivilgericht` | `strafrecht` | `rechtsanwalt` | `verwaltungsrecht`;
  `prio`: `hoch` | `normal` | `niedrig`; Absätze in der Erklärung mit `\n\n`).
- `typ`: immer genau `"begriffe"` (fehlt das Feld, gilt die normale Karte mit
  vier Antworten).
- `reihenfolge`: `true` = die Reihenfolge der Begriffe zählt (Schema); die App
  zeigt dann links in jedem Kästchen ein Nummernfeld und wertet die
  Reihenfolge. `false` = reine Auflistung, die Reihenfolge ist egal. Nur
  `true` oder `false`, ohne Anführungszeichen.
- `antworten`: die **richtigen** Begriffe. Bei `reihenfolge: true` in der
  **richtigen Reihenfolge** (Index 0 = erster Begriff); bei `false` in
  beliebiger Reihenfolge (die Karteikarten-Ansicht zeigt sie in dieser
  Reihenfolge). Mindestens 2 Einträge.
- `falsche`: die **falschen** Begriffe, die zusätzlich als Kästchen erscheinen.
  Mindestens 1 Eintrag.
- Die App mischt alle Kästchen (richtige und falsche) beim Anzeigen selbst.

## Technische Grenzen (prüft `node tools/validate.mjs`)

- Alle Einträge sind nichtleere Texte und untereinander eindeutig (ohne
  Beachtung der Groß-/Kleinschreibung).
- Insgesamt höchstens 12 Begriffe (`antworten` + `falsche`).
- Kurze Begriffe/Stichworte, da jeder Begriff ein einzelnes Kästchen ist.
