# Karteikarten-App für das Staatsexamen – Spezifikation v1

Diese Datei ist die maßgebliche Beschreibung der App. Neue Wünsche oder
Änderungen werden hier nachgetragen, damit eine spätere Sitzung (auch ohne
den ursprünglichen Chatverlauf) genau weiß, wie die App funktionieren soll.

## 1. Rahmen

- Eine PWA (Progressive Web App) für zwei Nutzer – Marius und Agnessa –, die
  beide für das Erste Juristische Staatsexamen lernen.
- Kein Build-Schritt: reines HTML/CSS/JavaScript (ES-Module), keine
  Frameworks, keine externen Bibliotheken. Diagramme werden als eigenes SVG
  gezeichnet.
- Funktioniert nach dem ersten Laden vollständig offline (Service Worker).
  Netzwerk wird nur für Updates und für die Synchronisierung zwischen den
  Geräten der beiden Nutzer gebraucht.
- Zielgeräte: iPhone (Safari, auf dem Home-Bildschirm) und Laptop (Browser).
- Design: bewusst vom Referenzprojekt „ukr-app“ übernommen – schlicht,
  hochwertig, mit Hell-/Dunkelmodus je nach Systemeinstellung. Serifenschrift
  (Literata) für Titel und Fragen/Antworten, Systemschrift (Fallback Inter)
  für die Bedienoberfläche. Schriften liegen lokal unter `/fonts/`.

## 2. Repo-Struktur

```
/index.html
/styles.css
/manifest.webmanifest
/sw.js
/icons/                 App-Icons (siehe Abschnitt 10)
/fonts/                 Literata, Inter (woff2, OFL-Lizenz)
/js/app.js              Routing, alle Bildschirme, Dialoge, Hinweise, Motivations-Overlay
/js/cards.js             Karteikarten-Anzeige, Warteschlangen-Logik (gemeinsam mit Frage-Antwort)
/js/quiz.js              Frage-Antwort-Anzeige (4 Antworten, Mischen)
/js/store.js             Lokale Datenhaltung (IndexedDB): Nutzer, Karten, Stufen, Statistik
/js/sync.js              Gist-Synchronisierung zwischen den Geräten
/js/stats.js             Statistik-Diagramm (eigenes SVG)
/js/tokens.js            Kleine Helfer (HTML escapen, Mischen)
/content/index.json      Gesamter Grundbestand an Karten, automatisch erzeugt
/content/<gebiet>/<id>.json   Einzelne Kartendateien des Grundbestands (Quelle)
/content/_inbox/         Eingang für neue Karten per GitHub-Upload (siehe README dort)
/docs/KARTEN-VORLAGE.md  Vorlage, mit der viele neue Karten auf einmal erzeugt werden
/tools/build-index.mjs   Baut content/index.json aus den Kartendateien
/tools/validate.mjs      Prüfskript für den Kartenbestand (Node.js)
/CLAUDE.md               Arbeitsregeln für künftige Sitzungen
/SPEC.md                 diese Datei
/README.md
```

### 2.1 Neue Karten einpflegen

- Viele Karten auf einmal entstehen über `docs/KARTEN-VORLAGE.md` in einem
  separaten, normalen Chat (nicht Claude Code) und werden dort als
  `.txt`-Dateien mit reinem JSON-Inhalt ausgegeben (siehe Abschnitt 3.2 für
  das Format).
- Diese Dateien gelangen entweder als Anhang in eine Claude-Code-Sitzung oder
  – bei größerer Menge – über `content/_inbox/` (direkter Upload im Repo über
  die GitHub-Webseite, siehe README dort).
- Claude Code vergibt beim Einsortieren die nächste freie Nummer je
  Rechtsgebiet (z. B. `strafrecht-0004`), legt die Datei unter
  `content/<gebiet>/` ab, prüft den Inhalt stichprobenartig, baut den Index
  neu (`node tools/build-index.mjs`) und validiert ihn
  (`node tools/validate.mjs`).
- Einzelne Karten kann außerdem jeder Nutzer direkt in der App über den Modus
  „Karten anlegen“ hinzufügen (siehe Abschnitt 5). Diese Karten werden nicht
  als Dateien im Repo abgelegt, sondern über die Gist-Synchronisierung
  zwischen den Geräten geteilt (siehe Abschnitt 8).

## 3. Kartenbestand (Grundbestand, „ohne Ersteller“)

### 3.1 `content/index.json`

```json
{
  "version": 1,
  "contentHash": "…",
  "cards": [
    {
      "id": "strafrecht-0001",
      "gebiet": "strafrecht",
      "frage": "…",
      "antworten": ["richtige Antwort", "falsch 1", "falsch 2", "falsch 3"],
      "erklaerung": "…",
      "creator": null,
      "ts": "2026-01-13T09:00:00.000Z"
    }
  ]
}
```

- Wird nicht von Hand gepflegt, sondern mit `node tools/build-index.mjs` aus
  den Dateien unter `content/<gebiet>/` erzeugt. Das Skript speichert eine
  Prüfsumme (`contentHash`) und erhöht `version` automatisch, sobald sich der
  Kartenbestand ändert (Cache-Invalidierung im Service Worker).
- Anders als im Referenzprojekt „ukr-app“ (dort enthält der Index nur
  Metadaten, der eigentliche Inhalt liegt in separaten Dateien) enthält
  `index.json` hier bereits die vollständige Karte. Das ist eine bewusste
  Vereinfachung: Karten sind klein, ein zusätzlicher Netzwerk-Abruf je Karte
  beim Öffnen einer Stufe würde nur unnötige Komplexität bringen.
- `gebiet` ∈ `zivilgericht`, `strafrecht`, `rechtsanwalt`, `verwaltungsrecht`.
- `creator` ist beim Grundbestand immer `null` (kein Nutzer-Tag). Von einem
  Nutzer angelegte Karten (siehe Abschnitt 5) tragen hier `"marius"` oder
  `"agnessa"` und liegen nicht in `content/`, sondern in der lokalen
  Datenbank und im gemeinsamen Gist (Abschnitt 8).
- `ts` ist der Erstellungszeitpunkt der Karte. Er dient nur als
  Sortier-Rückfalllösung für Karten, die noch nie von einem Nutzer bearbeitet
  wurden (siehe Warteschlange, Abschnitt 4).

### 3.2 Einzelne Kartendatei (`content/<gebiet>/<id>.json`)

Gleiche Felder wie ein Eintrag in `index.json` (siehe 3.1). `id` folgt dem
Muster `<gebiet>-0001`, `<gebiet>-0002`, … fortlaufend je Rechtsgebiet.

### 3.3 Validierung (`tools/validate.mjs`)

Prüft vor jedem Commit:

- Pflichtfelder sind gesetzt (`id`, `gebiet`, `frage`, genau 4 `antworten`,
  `erklaerung`, `ts`).
- `gebiet` ist eines der vier erlaubten Werte und stimmt mit dem Ordner
  überein.
- Keine doppelten IDs, jede Datei ist im Index gelistet und umgekehrt.
- `version` wurde erhöht, sobald sich `content/` (außer `content/_inbox`)
  gegenüber dem letzten Commit geändert hat.

`index.json` nie von Hand bearbeiten – immer `node tools/build-index.mjs`
laufen lassen.

## 4. Leitner-System (Stufen) und Warteschlange

- 5 Stufen (1–5). Neue Karten starten in Stufe 1.
- Bei **richtiger** Antwort (in Karteikarten- **oder** Frage-Antwort-Modus)
  wandert die Karte für den antwortenden Nutzer eine Stufe höher (maximal 5).
- Bei **falscher** Antwort fällt sie zurück auf Stufe 1.
- Der Fortschritt gilt modusübergreifend: Eine in Karteikarten auf Stufe 3
  gebrachte Karte erscheint im Frage-Antwort-Modus ebenfalls in Stufe 3, für
  denselben Nutzer.
- Der Fortschritt ist strikt pro Nutzer: Marius und Agnessa haben für
  dieselbe Karte unabhängige Stufen.
- **Warteschlange:** Beim Öffnen einer Stufe (in einem der beiden Lernmodi)
  wird einmalig eine Liste aller Karten dieses Rechtsgebiets gebildet, die
  für den aktuellen Nutzer gerade in dieser Stufe stehen, aufsteigend
  sortiert nach dem Zeitpunkt des letzten Stufenwechsels. Karten, die zuletzt
  in diese Stufe gewechselt sind, stehen also am Ende. Diese Reihenfolge
  bleibt für den gesamten Durchgang fest (neue Stufenwechsel während des
  Durchgangs verändern die bereits gebildete Liste nicht mehr).
- Rechtsgebiete bzw. Stufen ohne verfügbare Karten (für den aktuellen
  Nutzer) sind sichtbar, aber ausgegraut, mit dem Hinweis „Noch keine
  Karten“ (identisches Muster wie die Stufenwahl im Referenzprojekt
  „ukr-app“: gestrichelter Rand, deaktivierte Schaltfläche).

## 5. Ablauf in der App

1. **Nutzerwahl** (nur beim ersten Start bzw. nach „Nutzer wechseln“):
   Marius (blauer Farbakzent) oder Agnessa (pinker Farbakzent). Die Wahl wird
   lokal gespeichert und gilt bis zum nächsten Wechsel. Wechseln ist jederzeit
   über die Einstellungen möglich.
2. **Moduswahl** (3 Kacheln): „Karteikarten“, „Frage-Antwort“, „Karten
   anlegen“.
3. **Rechtsgebiet wählen** (4 Zeilen): Zivilgericht, Strafrecht,
   Rechtsanwalt, Verwaltungsrecht. In den beiden Lernmodi sind
   Rechtsgebiete ohne Karten ausgegraut; im Modus „Karten anlegen“ sind immer
   alle vier wählbar (die Wahl bestimmt nur das Rechtsgebiet der neuen
   Karte).
4. **Nur in den Lernmodi:** Stufe wählen (1–5, ausgegraut ohne Karten).
5. Danach beginnt der jeweilige Modus (siehe 5.1–5.3).

### 5.1 Karteikarten-Modus

- Oberes Feld zeigt nur die Frage.
- Unteres Feld ist zunächst ein Platzhalter („Antippen, um die Antwort zu
  zeigen“). Nach Antippen erscheint die richtige Antwort in derselben
  Schriftgröße wie die Frage, darunter abgesetzt und kleiner die Erklärung
  (mit `max-height` und `overflow-y: auto`, damit lange Erklärungen scrollen
  statt die Seite zu sprengen).
- Danach erscheinen zwei Schaltflächen: links „Falsch“ (rot), rechts
  „Richtig“ (grün). Ein Klick löst den Stufenwechsel aus (Abschnitt 4) und
  zeigt die nächste Karte der Warteschlange.
- Wurde die Karte von einem Nutzer angelegt (nicht Grundbestand), erscheint
  oben rechts im Fragefeld ein kleiner, unauffälliger Chip mit dem Namen des
  Erstellers.
- Ist die Warteschlange leer, erscheint ein Hinweis „Stufe abgeschlossen“.

### 5.2 Frage-Antwort-Modus

- Zeigt Frage und vier gemischte Antwortmöglichkeiten (A–D-Raster), davon
  eine richtig.
- Klick auf eine Antwort: sofortige Rückmeldung. Die gewählte Antwort wird
  bei richtiger Wahl grün, bei falscher Wahl rot markiert; ist die Wahl
  falsch, wird zusätzlich die richtige Antwort grün hervorgehoben.
- Darunter klappt die Erklärung aus, danach folgt ein „Weiter“-Button zur
  nächsten Karte in derselben Warteschlange wie im Karteikarten-Modus.
- Auch hier: Ersteller-Chip, falls vorhanden. Stufenwechsel wie in 5.1.

### 5.3 Karten anlegen

- Formular mit Fragefeld, vier Antwortfeldern (das erste ausdrücklich mit
  „Richtige Antwort“ beschriftet, die übrigen mit „Falsche Antwort 1/2/3“)
  und einem Erklärungsfeld.
- „Anlegen“ speichert die Karte mit dem zuvor gewählten Rechtsgebiet, dem
  aktuellen Nutzer als Ersteller, Stufe 1 und dem aktuellen Zeitstempel; die
  Felder werden danach geleert, das Formular bleibt geöffnet (kein
  Rücksprung), damit direkt die nächste Karte eingetragen werden kann.
- Neue Karten werden sofort synchronisiert (Abschnitt 8), damit sie auf dem
  Gerät des anderen Nutzers erscheinen.

## 6. Statistik

- Pro Nutzer wird täglich gezählt, wie viele Karten bearbeitet wurden
  (Karteikarten- und Frage-Antwort-Modus zusammen; jede beantwortete Karte
  zählt genau einmal, unabhängig davon, ob richtig oder falsch).
- Anzeige als kleines Liniendiagramm (eigenes SVG, kein Diagramm-Framework),
  x-Achse = die letzten 14 Tage.
- In den Einstellungen gibt es zwei getrennte, mit Ja/Nein-Rückfrage
  gesicherte Aktionen (nur für den aktuellen Nutzer, wirken nicht auf den
  anderen Nutzer und nicht auf die Karten selbst):
  - „Alle Karten auf Stufe 1 zurücksetzen“ – setzt den gesamten
    Stufen-Fortschritt zurück.
  - „Statistik löschen“ – löscht die Tagesstatistik.

## 7. Datenmodell (lokal, IndexedDB, Datenbank „lernapp“)

- `settings` – Schlüssel/Wert, u. a. `currentUser`, `gistToken`, `gistId`,
  `lastSync`, `lastSyncError`, `resetAt_marius`, `resetAt_agnessa`,
  `levelsResetAt_marius`, `levelsResetAt_agnessa`.
- `userCards` – von den Nutzern selbst angelegte Karten, `uuid`-Schlüssel:
  `{ uuid, gebiet, frage, antworten: [4], erklaerung, creator, ts }`.
  Append-only (Karten werden nie bearbeitet oder gelöscht).
- `levels` – Leitner-Stufe je Nutzer und Karte, Schlüssel
  `"<nutzer>:<cardId>"`: `{ key, user, cardId, stufe, ts }`. `ts` ist der
  Zeitpunkt des letzten Stufenwechsels dieser Karte durch diesen Nutzer.
- `events` – bearbeitete Karten je Nutzer, für die Tagesstatistik,
  append-only: `{ id, user, ts, cardId, correct, mode }` (`mode` ist
  `"cards"` oder `"quiz"`).

„Zurücksetzen“ funktioniert wie im Referenzprojekt „ukr-app“ über eine
Zeitgrenze statt über Löschen einzelner Einträge: `resetAt_<nutzer>` bzw.
`levelsResetAt_<nutzer>` merken den Zeitpunkt des Zurücksetzens; alle
Einträge mit `ts` vor oder bei dieser Grenze gelten als ungültig bzw. werden
entfernt. Das macht die Synchronisierung konfliktfrei (siehe Abschnitt 8).

## 8. Synchronisierung (Gist)

Wie im Referenzprojekt „ukr-app“: ein privates (secret) GitHub-Gist, das
beide Nutzer über denselben Token und dieselbe Gist-ID verbinden. Datei im
Gist: `stats.json`.

```json
{
  "v": 1,
  "cards": [
    { "uuid": "…", "gebiet": "strafrecht", "frage": "…", "antworten": ["…", "…", "…", "…"], "erklaerung": "…", "creator": "marius", "ts": "…" }
  ],
  "users": {
    "marius":  { "resetAt": null, "levelsResetAt": null, "levels": { "<cardId>": { "stufe": 3, "ts": "…" } }, "events": [ { "id": "…", "ts": "…", "cardId": "…", "correct": true, "mode": "cards" } ] },
    "agnessa": { "…": "…" }
  }
}
```

**Vereinigungsregeln (kein Konflikt möglich):**

- `cards`: einfache Vereinigung nach `uuid` (append-only, Karten werden nie
  geändert oder gelöscht).
- je Nutzer `levels`: pro Karte gewinnt der Eintrag mit dem **späteren**
  Zeitstempel (CRDT-artig: „letzter Schreibvorgang gewinnt“, ganz ohne
  Konflikterkennung, weil pro Karte immer nur ein Wert zählt).
- je Nutzer `events`: Vereinigung nach `id` (append-only), Einträge mit
  `ts <= resetAt` werden verworfen.
- je Nutzer `resetAt` / `levelsResetAt`: jeweils der spätere Wert aus lokal
  und Gist gilt danach auf allen Geräten; Einträge mit `ts <= levelsResetAt`
  gelten beim Zusammenführen als zurückgesetzt (Stufe 1) und werden lokal
  entfernt.

**Ablauf:** Die Synchronisierung läuft automatisch:

1. beim Start der App,
2. beim Öffnen eines Lernmodus (Karteikarten oder Frage-Antwort), damit der
   Stand aktuell ist,
3. nach jeder beantworteten Karte (in beiden Lernmodi),
4. beim Verlassen eines Lernmodus,
5. beim Anlegen einer neuen Karte,
6. bei Rückkehr der Internetverbindung (`online`-Ereignis).

Der Sync-Status (letzter Erfolg, Fehlermeldung) wird in den Einstellungen
angezeigt. Ohne Internetverbindung wird lokal weitergearbeitet; die nächste
erfolgreiche Synchronisierung gleicht alles ab.

Auth über einen GitHub-Token mit Berechtigung `gist`. Er wird einmal pro
Gerät in den Einstellungen eingegeben und lokal gespeichert, ebenso die
Gist-ID. Auf dem ersten Gerät reicht der Token – die Gist-ID entsteht
automatisch; auf jedem weiteren Gerät (unabhängig davon, welcher Nutzer
gerade aktiv ist) werden derselbe Token und dieselbe Gist-ID eingetragen.

## 9. Motivierende Einblendungen (nur für Agnessa)

Zwei unabhängige Auslöser, jeweils ein kurzzeitiges Overlay mit einem
zufällig gewählten Spruch (Liste in `js/app.js`, Konstante `SPRUECHE`),
das nach ca. 1,8 Sekunden automatisch verschwindet oder durch Antippen:

1. **Serie innerhalb eines Durchgangs:** Ein Durchgang ist eine
   zusammenhängende Sitzung in einem der beiden Lernmodi, beginnend beim
   Öffnen des Modus (Stufe gewählt) und endend beim Verlassen (Zurück-Knopf).
   Eine falsche Antwort setzt die Serie auf 0 zurück. Einblendung nach 5
   richtigen Antworten in Folge, dann bei 15 insgesamt, danach alle weiteren
   25 (40, 65, 90, …).
2. **Tagesgesamt:** unabhängig vom Durchgang, alle 50 an diesem Tag
   insgesamt bearbeiteten Karten (richtig oder falsch, beide Modi
   zusammengezählt).

Zum Testen ohne 5 bzw. 50 echte Antworten steht in der Browser-Konsole
`window.__lernapp.showMotivOverlay()` zur Verfügung, das Overlay unabhängig
von echten Ereignissen einmalig anzuzeigen.

## 10. PWA

- `manifest.webmanifest`, `sw.js` (Service Worker, App-Shell cache-first,
  `content/index.json` network-first mit Cache-Fallback).
- `APP_VERSION` in `sw.js` bei jeder Änderung an App-Dateien erhöhen, sonst
  erhalten installierte Geräte kein Update. Neue Dateien in `SHELL_FILES`
  ergänzen.
- **Icons:** Aus Zeitgründen wurden die App-Icons nicht aus einer SVG-Vorlage
  gerastert (in dieser Umgebung stand kein Werkzeug wie Inkscape oder
  ImageMagick zur Verfügung), sondern mit einem kleinen Python-Skript direkt
  als PNG erzeugt (einfaches, blockiges Kartensymbol in den App-Farben).
  Funktional entspricht das den Anforderungen an ein App-Icon; wer ein
  gestalterisch aufwendigeres Icon möchte, kann `icons/icon-*.png` jederzeit
  ersetzen (gleiche Dateinamen und Größen: 180, 192, 512, 512 maskable).

## 11. Ausgegraute Elemente (sichtbar, deaktiviert)

- Rechtsgebiete ohne verfügbare Karten in der Rechtsgebietswahl der beiden
  Lernmodi (im Modus „Karten anlegen“ nie ausgegraut).
- Stufen ohne verfügbare Karten (für den aktuellen Nutzer) in der
  Stufenwahl.
- Die Kacheln „Karteikarten“ und „Frage-Antwort“ selbst, solange es
  überhaupt noch keine einzige Karte im gesamten Kartenbestand gibt.

## 12. Bewusste Entscheidungen und Vereinfachungen (Stand: erste Umsetzung)

- **5 Leitner-Stufen** wie vom Auftrag vorgegeben; keine Änderung nötig.
- **Konvention „erste Antwort ist immer richtig“** (`antworten[0]`) statt
  Radiobuttons oder eines separaten `a`-Index-Felds – sowohl im
  Anlege-Formular als auch im Karten-Format aus `docs/KARTEN-VORLAGE.md`.
  Das Mischen der Reihenfolge übernimmt die App beim Anzeigen.
- **`content/index.json` enthält den vollständigen Karteninhalt**, nicht nur
  Metadaten wie im Referenzprojekt „ukr-app“ (siehe Begründung in
  Abschnitt 3.1).
- **Gist-Schema** wie in Abschnitt 8 beschrieben: ein gemeinsames Gist,
  Karten global vereinigt, Fortschritt und Statistik strikt pro Nutzer
  verschachtelt.
- **App-Icons vereinfacht** (siehe Abschnitt 10), da kein Bildwerkzeug zur
  Rasterung eines SVG zur Verfügung stand.
- **„Durchgang“ für die Serien-Einblendung** = eine Öffnung eines Lernmodus
  bis zum Verlassen (Zurück-Knopf), unabhängig vom Rechtsgebiet oder der
  Stufe innerhalb dieser einen Öffnung.

## 13. Offen (später zu klären)

- Es gibt noch keine Möglichkeit, eine einmal angelegte Karte zu bearbeiten
  oder zu löschen (weder im Grundbestand noch bei selbst angelegten Karten).
  Sollte das gebraucht werden, wäre das eine bewusste Erweiterung des
  Datenmodells (aktuell überall „append-only“ ausgelegt).
- Automatisierte Tests im Browser (z. B. mit Playwright) konnten in der
  Umgebung, in der diese Version entstand, nicht ausgeführt werden, weil kein
  entsprechendes Werkzeug zur Verfügung stand. Geprüft wurde stattdessen über
  einen lokalen Server, direkte HTTP-Abrufe der Seiten und eine sorgfältige
  Manuelle Durchsicht des Codes. Vor dem produktiven Einsatz empfiehlt sich
  ein kurzer manueller Test auf einem iPhone und einem Laptop.
