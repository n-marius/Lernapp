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
      "prio": "normal",
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
- `prio` ∈ `hoch`, `normal`, `niedrig` – Ausgangswert für den Automatikmodus
  (Abschnitt 5.1a). Jeder Nutzer kann sie durch Antippen des Prio-Symbols
  für sich selbst ändern, ohne den hier gespeicherten Grundwert zu berühren.
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

- Pflichtfelder sind gesetzt (`id`, `gebiet`, `prio`, `frage`, genau 4
  `antworten`, `erklaerung`, `ts`).
- `gebiet` ist eines der vier erlaubten Werte und stimmt mit dem Ordner
  überein; `prio` ist `hoch`, `normal` oder `niedrig`.
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
2. **Moduswahl** (3 Kacheln, bei Marius 4): „Karteikarten“, „Frage-Antwort“,
   „Karten anlegen“ und – nur wenn Marius der aktuell gewählte Nutzer ist –
   „Flaggs beheben“ (siehe Abschnitt 5.4).
3. **Nur nach „Karteikarten“ oder „Frage-Antwort“:** Manuell oder Automatisch
   wählen (siehe Abschnitt 5.1a). „Karten anlegen“ und „Flaggs beheben“
   überspringen diesen Schritt.
4. **Rechtsgebiet wählen** (4 Zeilen): Zivilgericht, Strafrecht,
   Rechtsanwalt, Verwaltungsrecht. In den beiden Lernmodi sind
   Rechtsgebiete ohne Karten ausgegraut; im Modus „Karten anlegen“ sind immer
   alle vier wählbar (die Wahl bestimmt nur das Rechtsgebiet der neuen
   Karte). In den beiden Lernmodi sitzen oberhalb der Liste drei kleine
   Umschalt-Knöpfe (Prio-Filter, 34 px) – dieselben Prio-Symbole wie auf der
   Karte (Abschnitt 5.1a), ohne Text. Beim Öffnen der Seite sind alle drei
   aktiv; Antippen schaltet eine Prio ab (Fläche leer, Rand und Zeichen blass
   und grau, fein diagonal durchgestrichen; das Zeichen ist entlang des
   Strichs schmal ausgespart, bleibt aber erkennbar) bzw. wieder an – mindestens eine muss aktiv bleiben. Nur Karten mit
   einer der aktiven Prios (persönliche Prio des Nutzers, siehe 5.1a) werden
   in Kartenzahl, Stufenwahl und dem anschließenden Lauf berücksichtigt.
   Die Auswahl gilt nur für diesen einen Lauf und wird nicht gespeichert.
5. **Nur im manuellen Lernmodus:** Stufe wählen (1–5, ausgegraut ohne
   Karten). Der Automatikmodus überspringt diesen Schritt – er zieht Karten
   aus allen Stufen des Rechtsgebiets zugleich (Abschnitt 5.1a).
6. Danach beginnt der jeweilige Modus (siehe 5.1–5.3).

### 5.1 Karteikarten-Modus

- Oberes Feld zeigt nur die Frage.
- Unteres Feld ist zunächst ein Platzhalter („Antippen, um die Antwort zu
  zeigen“). Nach Antippen erscheint die richtige Antwort in derselben, etwas
  kleineren Schriftgröße wie die Frage (19 px statt vorher 21 px, damit auf
  schmalen Bildschirmen mehr Platz bleibt), darunter abgesetzt und kleiner
  die Erklärung. Die Erklärung ist bewusst höhenbegrenzt (160 px) und wird
  bei langem Text innerhalb des Felds gescrollt, damit die Karte nicht
  ausufert.
- Die Schaltflächen „Falsch“ (rot, links) und „Richtig“ (grün, rechts) sitzen
  **fest in der unteren Leiste** und teilen sich dort die volle
  Bildschirmbreite (je links/rechts der Mitte), sind ausgegraut, bis die
  Antwort aufgedeckt wurde. Ein Klick löst den Stufenwechsel aus
  (Abschnitt 4) und zeigt die nächste Karte. Rechts neben „Richtig“ sitzt ein
  kleiner, quadratischer Knopf in hellerem Blau (`--blue`) mit doppeltem
  Pfeil nach oben („Direkt in Stufe 4“). Er nimmt seinen Platz **nur von
  „Richtig“** – „Falsch“ behält die volle linke Hälfte, die Trennung zwischen
  Falsch und Richtig bleibt in der Bildschirmmitte. Der Knopf ist für Karten,
  die man schon sicher kann – er wird
  gleichzeitig mit Falsch/Richtig aktiv und zählt wie eine richtige Antwort
  für Statistik und Motivations-Einblendungen, setzt die Stufe aber ohne
  Umweg über die übrigen Stufen direkt auf 4.
  Gestaltung von Falsch/Richtig/Stufe 4 wie die markierten Antworten im
  Frage-Antwort-Modus: kräftiger farbiger Rand (rot/grün/blau), blass getönte
  Fläche, farbige Schrift; solange inaktiv nur grauer Rand und graue Schrift. Darunter, deutlich kleiner und
  unauffällig in der Ecke, steht der Fortschritt („x von y bearbeitet“).
- Wurde die Karte von einem Nutzer angelegt (nicht Grundbestand), erscheint
  oben rechts im Fragefeld ein kleiner, unauffälliger Chip mit dem Namen des
  Erstellers.
- Ist die Warteschlange leer (manueller Modus), erscheint ein Hinweis „Stufe
  abgeschlossen“.

### 5.1a Automatikmodus: verteilte Wiederholung

Der Automatikmodus (wählbar sowohl für Karteikarten als auch für
Frage-Antwort) zeigt keine feste Liste, sondern zieht bei jeder Karte neu
gewichtet aus **allen** Karten des gewählten Rechtsgebiets – unabhängig von
der Stufe. Das ist ein vereinfachter, aber an anerkannten Lernkartei-Systemen
(z. B. Anki) orientierter Algorithmus: mehrere unabhängige Gewichte werden
miteinander multipliziert, statt eine einzelne komplizierte Formel zu bauen.
Implementiert in `js/cards.js` (`pickWeightedCard`).

Vier Gewichtungsfaktoren:

1. **Stufe:** Jede Stufe wiegt nur noch ein Drittel der vorherigen Stufe
   (Faktor 3 pro Stufe: 81 – 27 – 9 – 3 – 1 für Stufe 1–5). Eine Karte in
   Stufe 5 hat also nur 1/81 des Gewichts einer Karte in Stufe 1 und kommt
   dementsprechend selten dran, ohne komplett zu verschwinden. Da die Stufe
   modusübergreifend gilt (Abschnitt 4), wirkt sich eine im **manuellen**
   Modus bearbeitete Karte unmittelbar auch auf die Automatik aus – für
   beide Lernmodi (Karteikarten und Frage-Antwort) gleichermaßen.
2. **Zeit seit der letzten Bearbeitung** (ebenfalls modusübergreifend):
   Bei einem Kartenbestand von perspektivisch hunderten bis über tausend
   Karten sorgt schon die schiere Menge für eine natürliche Verteilung
   (praktisch FIFO). Das Gewicht muss deshalb nicht schnell ansteigen –
   verwendet wird eine Weibull-Kurve (in Zuverlässigkeitsmodellen der
   gängige Ansatz für „verzögert einsetzende, dann beschleunigende“
   Zeitverläufe, die sich 100 % nur annähert, ohne je darüber
   hinauszugehen): nach 1 Tag ca. 7 %, nach 3 Tagen ca. 20 %, nach 1 Woche
   ca. 45 %, nach 2 Wochen ca. 75 %, nach 1 Monat ca. 97 % des vollen
   Gewichts – danach läuft die Kurve flach auf 100 % zu. Direkt nach der
   Bearbeitung liegt das Gewicht bei einem kleinen Sockelwert (2 %), damit
   eine gerade erst beantwortete Karte praktisch nicht sofort wieder
   auftaucht.
3. **Nie bearbeitete Karten** bekommen zusätzlich den dreifachen Bonus, damit
   neue Karten zügig einmal drankommen, statt lange unten anzustehen.
4. **Prio:** Jede Karte hat eine Priorität `hoch`, `normal` oder `niedrig`
   (Grundwert aus dem Kartenbestand, siehe Abschnitt 3.1; von Nutzern selbst
   angelegte Karten starten bei `normal`). `hoch` wird moderat aufgewichtet
   (Faktor 1,5), `niedrig` moderat abgewichtet (Faktor 0,6) – bewusst deutlich
   schwächer als der Stufen-Faktor, damit die Prio die Grundlogik nur
   nachjustiert, nicht überstimmt.

Die vier Faktoren werden multipliziert; aus den entstehenden Gewichten wird
per Zufall gezogen (höheres Gewicht = höhere Wahrscheinlichkeit, nicht
Garantie). Dieselbe Karte wird nie zweimal direkt hintereinander gezogen,
solange das Rechtsgebiet mehr als eine Karte enthält. Der Automatikmodus hat
kein festes Ende („Stufe abgeschlossen“ gibt es hier nicht) – er läuft, bis
über „Modus verlassen“ zurückgegangen wird. Stufenwechsel, Statistik,
Melden-Funktion und die Motivations-Einblendungen für Agnessa funktionieren
identisch zum manuellen Modus.

**Prio-Symbol und persönliche Änderung:** In beiden Lernmodi (manuell und
automatisch) zeigt ein kompaktes Symbol (24 px, ohne Text) **oben rechts**
im Fragefeld (vom Fragetext umflossen, neben einem etwaigen Ersteller-Chip)
die aktuelle Prio der Karte. Das Symbol ist ein einziges SVG
(`js/tokens.js` `prioIcon`): Fläche als „Squircle“ (Superellipse, weichere
Ecken als ein CSS-Radius) in blasser Prio-Farbe mit feinem Innenring,
darauf das Zeichen in voller Farbe – Dreiecke mit weich gerundeten Ecken und
optisch zur Spitze hin zentriert: Dreieck aufwärts/rot = hoch,
Strich/grau = normal, Dreieck abwärts/blau = niedrig. Antippen schaltet zur nächsten Prio
weiter (hoch → normal → niedrig → hoch). Diese Änderung ist **rein
persönlich**: Sie wirkt sich nur auf die Gewichtung und Anzeige für den
Nutzer aus, der sie vorgenommen hat, verändert also weder die Karte selbst
noch die Sicht des anderen Nutzers (technisch: eine per Nutzer und Karte
gespeicherte Übersteuerung, siehe Abschnitt 7 und 8).

### 5.2 Frage-Antwort-Modus

- Zeigt Frage und darunter die vier Antwortmöglichkeiten **einzeln in voller
  Breite untereinander** (A–D), davon eine richtig.
- Klick auf eine Antwort: sofortige Rückmeldung. Die gewählte Antwort wird
  bei richtiger Wahl grün, bei falscher Wahl rot markiert; ist die Wahl
  falsch, wird zusätzlich die richtige Antwort grün hervorgehoben.
- Die Erklärung klappt **aus der richtigen Antwort heraus nach unten** aus
  (steht also ggf. zwischen den Antworten) und bildet mit ihr optisch eine
  Einheit (gleicher grüner Rand, gleiche Füllung). Sie ist höhenbegrenzt
  (160 px) und wird bei langem Text innerhalb des Felds gescrollt. Der
  „Weiter“-Button sitzt **fest in der unteren Leiste über die volle
  Breite** und ist ausgegraut, bis eine Antwort gewählt wurde. Rechts daneben
  (auf seine Kosten) derselbe blaue „Direkt in Stufe 4“-Knopf wie im
  Karteikarten-Modus (Abschnitt 5.1), gleichzeitig mit „Weiter“ aktiv;
  darunter klein der Fortschritt.
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

### 5.4 Karte melden

- In beiden Lernmodi (Karteikarten und Frage-Antwort) gibt es in der
  Kopfleiste einen kleinen, unauffälligen Flaggen-Knopf. Ein Klick öffnet
  einen Dialog: eine Auswahl „Frage“ oder „Antwort“ (was genau nicht
  stimmt), ein mehrzeiliges Textfeld für eine kurze Beschreibung, sowie
  „Abbrechen“ und „Absenden“. „Absenden“ ist erst möglich, wenn eine
  Beschreibung eingetragen wurde.
- Beim Absenden wird eine Meldung gespeichert (siehe `flags` in Abschnitt 7)
  und sofort synchronisiert, ein Hinweis „Danke, gemeldet.“ erscheint, und es
  geht direkt mit der nächsten Karte der Warteschlange weiter. Die gemeldete
  Karte gilt nicht als beantwortet – es findet kein Stufenwechsel statt.
- Eine Karte mit mindestens einer offenen Meldung wird ab sofort für **beide**
  Nutzer aus allen Kartenlisten ausgeblendet (Lernmodi, Rechtsgebiets- und
  Stufenzählungen), bis die Meldung im Modus „Flaggs beheben“ bearbeitet
  wurde. Das gilt unabhängig davon, wer die Karte gemeldet hat.

### 5.5 Flaggs beheben (nur Marius)

- Diese Kachel ist ausschließlich sichtbar und wählbar, wenn Marius der
  aktuell gewählte Nutzer ist. Bei Agnessa fehlt sie auf dem
  Moduswahl-Bildschirm vollständig.
- Es gibt keinen Rechtsgebiets- oder Stufen-Zwischenschritt: Ein Klick auf die
  Kachel führt direkt zu einer Übersicht, die alle offenen Meldungen
  nacheinander als Warteschlange zeigt (Kopfzeile „Meldung X von Y“).
- Zu jeder Meldung wird die vollständige Karte gezeigt (Frage, alle vier
  Antworten mit der richtigen sichtbar hervorgehoben, Erklärung), dazu ein
  kleiner Hinweis „Frage gemeldet“ oder „Antwort gemeldet“, die Notiz des
  meldenden Nutzers im Klartext und ein kleiner Namens-Chip, wer gemeldet
  hat.
- Drei Aktionen stehen zur Wahl:
  - **Löschen** – nach einer Ja/Nein-Rückfrage wird die Karte überall
    ausgeblendet (siehe `cardEdits.deleted` in Abschnitt 7) und alle offenen
    Meldungen dieser Karte gelten als erledigt. Das lässt sich nicht
    rückgängig machen.
  - **Überspringen** – nichts wird verändert, die Meldung bleibt offen und
    taucht innerhalb derselben Sitzung erst wieder auf, wenn alle anderen
    offenen Meldungen einmal gezeigt wurden (kommt „am Ende der Runde“
    erneut).
  - **Bearbeiten** – blendet an derselben Stelle ein vorausgefülltes
    Formular ein (Frage, die vier Antworten – das erste Feld weiterhin
    „Richtige Antwort“ – und Erklärung). „Speichern“ legt eine Korrektur an
    (siehe `cardEdits` in Abschnitt 7), erledigt alle offenen Meldungen
    dieser Karte und synchronisiert sofort; „Abbrechen“ kehrt unverändert zur
    Kartenansicht zurück.
- Sind keine offenen Meldungen mehr vorhanden, erscheint ein Hinweis „Keine
  offenen Meldungen“ / „Alle gemeldeten Karten sind bearbeitet.“

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
- `prios` – persönliche Prio-Änderung je Nutzer und Karte, gleicher
  Schlüsselaufbau wie `levels`: `{ key, user, cardId, prio, ts }`. Nur
  vorhanden, wenn dieser Nutzer die Prio dieser Karte mindestens einmal
  selbst geändert hat; ohne Eintrag gilt die Grund-Prio der Karte
  (Abschnitt 3.1). Ein Stufen-Reset (siehe unten) setzt `prios` **nicht**
  zurück – die persönliche Prio bleibt bewusst unabhängig vom Lernfortschritt.
- `events` – bearbeitete Karten je Nutzer, für die Tagesstatistik,
  append-only: `{ id, user, ts, cardId, correct, mode }` (`mode` ist
  `"cards"` oder `"quiz"`).
- `flags` – Meldungen zu Karten, Schlüssel `id` (uuid):
  `{ id, cardId, field, note, flaggedBy, ts, status }`. `field` ist
  `"frage"` oder `"antwort"` (was an der Karte nicht stimmt), `flaggedBy`
  ist `"marius"` oder `"agnessa"`, `status` ist `"open"` oder `"resolved"`.
  Jede Karte mit mindestens einer offenen Meldung wird für alle Nutzer aus
  allen Kartenlisten ausgeblendet (siehe Abschnitt 5.4).
- `cardEdits` – Korrekturen bzw. Löschungen einzelner Karten, Schlüssel
  `cardId` (ein Eintrag je Karte, egal ob Grundbestand oder von einem Nutzer
  angelegt): `{ cardId, ts, editedBy, deleted, frage?, antworten?, erklaerung? }`.
  `deleted: true` blendet die Karte überall dauerhaft aus (Lernmodi,
  Rechtsgebiets-/Stufenzählungen, Flag-Übersicht); ansonsten überschreiben
  die vorhandenen Felder (`frage`, `antworten`, `erklaerung`) beim Anzeigen
  die entsprechenden Felder der Basis-Karte.
- `cardId` ist bei Karten aus dem Grundbestand ihr `id`-Feld, bei von Nutzern
  angelegten Karten ihr `uuid`-Feld (beide Bezeichner sind bei neu
  angelegten Karten identisch).

„Zurücksetzen“ funktioniert wie im Referenzprojekt „ukr-app“ über eine
Zeitgrenze statt über Löschen einzelner Einträge: `resetAt_<nutzer>` bzw.
`levelsResetAt_<nutzer>` merken den Zeitpunkt des Zurücksetzens; alle
Einträge mit `ts` vor oder bei dieser Grenze gelten als ungültig bzw. werden
entfernt. Das macht die Synchronisierung konfliktfrei (siehe Abschnitt 8).

## 8. Synchronisierung (Gist)

Wie im Referenzprojekt „ukr-app“: ein privates (secret) GitHub-Gist, das
beide Nutzer über denselben Token und dieselbe Gist-ID verbinden. Datei im
Gist: `stats.json`.

**Hinweis beim ersten Öffnen:** Ist noch kein Token hinterlegt (leeres
`gistToken`), blendet die App direkt nach dem Start einen Dialog ein, der
Token und optional Gist-ID abfragt – als Erinnerung, damit nicht versehentlich
ohne Synchronisierung gelernt wird. Der Dialog lässt sich über „Später“ oder
Tippen daneben schließen, ohne etwas einzugeben (die Einrichtung geht
jederzeit über die Einstellungen nach). Nach dem Speichern geht es
synchronisiert weiter.

```json
{
  "v": 1,
  "cards": [
    { "uuid": "…", "gebiet": "strafrecht", "frage": "…", "antworten": ["…", "…", "…", "…"], "erklaerung": "…", "creator": "marius", "ts": "…" }
  ],
  "users": {
    "marius":  { "resetAt": null, "levelsResetAt": null, "levels": { "<cardId>": { "stufe": 3, "ts": "…" } }, "prios": { "<cardId>": { "prio": "hoch", "ts": "…" } }, "events": [ { "id": "…", "ts": "…", "cardId": "…", "correct": true, "mode": "cards" } ] },
    "agnessa": { "…": "…" }
  },
  "flags": {
    "<flag-id>": { "id": "…", "cardId": "…", "field": "frage", "note": "…", "flaggedBy": "agnessa", "ts": "…", "status": "open" }
  },
  "cardEdits": {
    "<cardId>": { "cardId": "…", "ts": "…", "editedBy": "marius", "deleted": false, "frage": "…", "antworten": ["…", "…", "…", "…"], "erklaerung": "…" }
  }
}
```

**Vereinigungsregeln (kein Konflikt möglich):**

- `cards`: einfache Vereinigung nach `uuid` (append-only, Karten werden nie
  geändert oder gelöscht).
- je Nutzer `levels`: pro Karte gewinnt der Eintrag mit dem **späteren**
  Zeitstempel (CRDT-artig: „letzter Schreibvorgang gewinnt“, ganz ohne
  Konflikterkennung, weil pro Karte immer nur ein Wert zählt).
- je Nutzer `prios`: genauso wie `levels` (pro Karte gewinnt der spätere
  Zeitstempel).
- je Nutzer `events`: Vereinigung nach `id` (append-only), Einträge mit
  `ts <= resetAt` werden verworfen.
- je Nutzer `resetAt` / `levelsResetAt`: jeweils der spätere Wert aus lokal
  und Gist gilt danach auf allen Geräten; Einträge mit `ts <= levelsResetAt`
  gelten beim Zusammenführen als zurückgesetzt (Stufe 1) und werden lokal
  entfernt.
- `flags`: pro Meldung (`id`) gewinnt der Eintrag mit dem **späteren**
  Zeitstempel – genau wie bei den Kartenstufen. Wird eine Meldung bearbeitet
  oder die Karte gelöscht, bekommt sie einen neuen Zeitstempel und den Status
  `"resolved"`, damit sich das gegenüber älteren, noch offenen Ständen auf
  anderen Geräten korrekt durchsetzt.
- `cardEdits`: pro Karte (`cardId`) gewinnt der Eintrag mit dem **späteren**
  Zeitstempel.

**Ablauf:** Die Synchronisierung läuft automatisch:

1. beim Start der App,
2. beim Öffnen eines Lernmodus (Karteikarten oder Frage-Antwort) oder des
   Modus „Flaggs beheben“, damit der Stand aktuell ist,
3. nach jeder beantworteten Karte (in beiden Lernmodi),
4. beim Verlassen eines Lernmodus oder von „Flaggs beheben“,
5. beim Anlegen einer neuen Karte,
6. beim Melden einer Karte, sowie beim Löschen oder Bearbeiten einer Karte im
   Modus „Flaggs beheben“,
7. bei Rückkehr der Internetverbindung (`online`-Ereignis).

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
- **Icons:** Dunkelblauer Hintergrund (`--marius`, #2a4f8f) mit einer weißen
  Karteikarte, darin das Paragraphenzeichen „§“ – erzeugt, indem eine kleine
  HTML-Vorlage im Browser gerendert und als PNG abfotografiert wurde (in
  dieser Umgebung stand kein Werkzeug wie Inkscape oder ImageMagick zur
  Verfügung, dafür aber ein Browser mit echter Schriftdarstellung). Wer ein
  anderes Icon möchte, kann `icons/icon-*.png` jederzeit ersetzen (gleiche
  Dateinamen und Größen: 180, 192, 512, 512 maskable).

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
- **Prio-Gewichte** (Abschnitt 5.1a) bewusst moderat gewählt (1,5 / 1 / 0,6),
  damit die Prio die stufenbasierte Grundlogik nur nachjustiert.
- **Zeitkurve des Automatikmodus** (Weibull, Formparameter 1,25, Skala 260
  Std.) auf Wunsch bewusst mit langem, flachem Auslauf: Sie nähert sich
  100 % nur an, ohne je darüber hinauszugehen, und erreicht diesen Bereich
  erst nach rund einem Monat (1 Tag ≈ 7 %, 3 Tage ≈ 20 %, 1 Woche ≈ 45 %,
  2 Wochen ≈ 75 %, 1 Monat ≈ 97 %). Bei Bedarf lässt sich das in
  `js/cards.js` (`AUTO_RECENCY_TAU_HOURS`, `AUTO_RECENCY_SHAPE`) leicht
  nachjustieren.
- **Prio-Symbol-Farben:** hoch = rot, normal = grau, niedrig = blau (auf
  Wunsch geändert; ursprünglich akzentfarben/grau/gedämpft). Das Blau für
  „niedrig“ und „Direkt in Stufe 4“ ist ein helleres Blau (`--blue`) als der dunkle Marius-Akzent. Symbol bleibt ausdrücklich
  Dreieck/Strich im abgerundeten Quadrat ohne Text (Nutzerwunsch).

## 13. Offen (später zu klären)

- Eine Karte lässt sich nur über den Umweg einer Meldung bearbeiten oder
  löschen (Abschnitt 5.4/5.5, nur für Marius). Eine direkte, unabhängig von
  einer Meldung nutzbare Bearbeiten/Löschen-Funktion gibt es weiterhin nicht.
- Automatisierte Tests im Browser (z. B. mit Playwright) konnten in der
  Umgebung, in der diese Version entstand, nicht ausgeführt werden, weil kein
  entsprechendes Werkzeug zur Verfügung stand. Geprüft wurde stattdessen über
  einen lokalen Server, direkte HTTP-Abrufe der Seiten und eine sorgfältige
  Manuelle Durchsicht des Codes. Vor dem produktiven Einsatz empfiehlt sich
  ein kurzer manueller Test auf einem iPhone und einem Laptop.
