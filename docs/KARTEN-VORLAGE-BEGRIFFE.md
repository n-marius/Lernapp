# Formatvorlage: Karte im Format „Begriffe“

Reine Formatvorlage für Karten, deren Antwort eine Abfolge oder Auflistung von
Begriffen ist. Wann das Format zu verwenden ist und wie die Antworten
inhaltlich aufzubauen sind, regelt die übrige Kartenvorlage
(`docs/KARTEN-VORLAGE.md`) bzw. der jeweilige Auftrag.

Ausgabe wie bei allen Karten: pro Karte eine `.txt`-Datei mit reinem JSON
(kein Codeblock, kein Begleittext), Dateiname `<gebiet>_<kurzes-thema>.txt`.

## Wann verwenden

Immer dann, wenn die Antwort eine bloße Aufzählung ist: Schemata, Abläufe,
Prüfungsreihenfolgen, Aufbau (dann `reihenfolge: true`) oder Listen von
Beispielen, Voraussetzungen, Merkmalen in beliebiger Reihenfolge (dann
`reihenfolge: false`). Zuordnungen und Gegenüberstellungen („A: x; B: y“)
bleiben normale Karten mit vier Antworten.

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

## Inhaltliche Regeln

- Je nach Anzahl der richtigen Begriffe etwa zwei bis vier falsche Begriffe.
- Falsche Begriffe knifflig, aber keine Finte: nicht bloß umformulierte richtige
  Begriffe, keine Begriffe, die in anderer Lesart ebenfalls zutreffen, bei Zahlen
  keine extreme Ähnlichkeit. Gut geeignet sind Begriffe aus benachbarten
  Kategorien (z. B. Warnsignale als falsche Begriffe bei Realitätskennzeichen).
- Richtige und falsche Begriffe äußerlich gleich gestalten (Länge, Normzitate,
  Klammerzusätze).
- Optionale Schritte eines Ablaufs dürfen mit „ggf.“ gekennzeichnet werden.
- Einzelheiten und Normen gehören in die `erklaerung`.
