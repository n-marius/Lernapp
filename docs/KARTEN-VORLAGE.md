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
- Anzahl Karten: 10 (bei beigefügtem Quellmaterial: so viele wie nötig, siehe unten)
- Quellmaterial (optional, z. B. Folien, Skript):

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
  "prio": "normal",
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
- `prio`: genau eines von `hoch`, `normal`, `niedrig` (siehe „Priorität“).
- `frage`: ein präziser, examensnaher Sachverhalt oder eine Wissensfrage. Kein Fließtext-Sachverhalt über mehrere Absätze – die Frage muss auf eine Bildschirmzeile bis wenige Zeilen passen.
- `antworten`: **genau 4** Einträge, Index 0 = richtige Antwort, die anderen drei plausibel, aber eindeutig falsch (keine Wortspiele, keine Trivial-Ablenker).
- `erklaerung`: Fließtext, typischerweise ein bis zwei kurze Absätze (Absatztrennung im JSON mit `\n\n`), mit Normverweis wo möglich, erklärt **warum** die Antwort richtig ist (nicht nur eine Wiederholung der Antwort).
- Ausschließlich inhaltlich korrektes, aktuelles deutsches Recht. Bei Unsicherheiten (z. B. bei umstrittenen Meinungsstreiten) die herrschende Meinung wählen und dies im Chat kurz erwähnen.
- Sprache: klares, examenstypisches Deutsch, keine Umgangssprache.

## Inhaltliche Regeln (insbesondere bei beigefügtem Quellmaterial)

- Quellmaterial vollständig durchgehen (einschließlich Grafiken, Tabellen, SmartArts). Jede nicht offensichtlich unwichtige oder grundlegende Information verwerten, insbesondere aus dem Prozessrecht und zur Klausurtechnik. Es darf nichts Relevantes ausbleiben.
- Nur Informationen aus dem Quellmaterial verwenden, nichts hinzuerfinden; die Themen sind komplex und müssen präzise sein. Zusammenfassen oder besser darstellen ist erlaubt.
- `frage` und richtige Antwort nach dem Prinzip der minimalen Information: so knapp wie möglich, pro Karte möglichst eine Information; klar zusammenhängende Informationen dürfen zusammen stehen.
- Normverweise in Antworten stets mit inhaltlichem Stichwort verbinden (z. B. „Pflichtgemäßes Ermessen (§ 244 Abs. 5 S. 1 StPO entsprechend)“). Reine Normangaben nur, wenn die Frage gezielt nach einer Norm fragt.
- Abläufe und Prüfungsreihenfolgen (z. B. Ablauf der Zeugenvernehmung) als eine Karte mit den Schritten als Stichworten; wichtige Details einzelner Schritte erhalten eigene Karten. Zusammengehörige Übersichten (z. B. Maßstäbe je Beweismittel) dürfen gebündelt werden, Einzelheiten dann in die Erklärung.
- Antworten dürfen stichwortartig sein und gängige, verständliche Abkürzungen verwenden (z. B. Reihenfolge im Sachbericht: „Unstreitig, str. Kl., Anträge, str. Bekl., Replik, Duplik“).
- Alle vier Antworten äußerlich ähnlich gestalten (Länge, Detailgrad, Aufbau). Die richtige Antwort darf nicht die auffällig längste oder detaillierteste sein; sie wird lieber einfach und knapp gefasst, Details gehören in die `erklaerung`. Ausnahme: Neben „Ja“/„Nein“ dürfen die anderen Möglichkeiten kurz beschrieben werden, wo das zwingend nötig ist. Falsche Antworten nicht zu offensichtlich falsch formulieren. Das gilt auch für die Form: Enthält nur die richtige Antwort Normzitate, Klammerzusätze oder Einschränkungen wie „z. B.“, „v. a.“, „insb.“, „ggf.“, hebt sie sich ab; solche Elemente entweder in alle Antworten aufnehmen oder in die Erklärung verlagern. Konkret formulierte richtige Antworten erfordern ebenso konkret formulierte falsche Antworten.
- Die drei falschen Antworten selbst ausdenken: keine Fangfragen oder Finten, dürfen aber ähnlich und schwer sein. Finte ist insbesondere eine falsche Antwort, die sich von der richtigen nur durch eine Absatz-/Paragraphennummer, einen einzelnen vertauschten Bestandteil oder ein einschränkendes „nur“ unterscheidet. Nennt das Quellmaterial Negativbeispiele (z. B. „Falsch: …“), diese bevorzugt als falsche Antworten verwenden.
- `erklaerung`: Informationen des Quellmaterials verwenden; vorhandene Erklärungen dürfen wörtlich übernommen werden.
- Fälle aus dem Quellmaterial nicht als eigene Karten abfragen: Die Karte fragt die allgemeine Regel ab, der Fall dient höchstens als Beispiel in der Erklärung. Überschneidungen mit bereits bestehenden Karten zusammenführen statt doppeln.
- Verwendeten Gesetzesinhalt selbst am aktuellen Gesetzestext prüfen. Die Prüfung dient nur der Richtigkeit: keine zusätzlichen Details, Rückausnahmen oder Voraussetzungen aus dem Gesetz ergänzen, die nicht im Quellmaterial stehen (Ausnahme: Karten zu reinen Normverweisen).
- Verweist das Quellmaterial nur auf eine Norm, ohne deren Inhalt darzustellen (z. B. „siehe § 487 ZPO“), eine Karte mit dem Norminhalt anlegen; den Gesetzeswortlaut dabei präzise wiedergeben.
- Veraltete Normverweise im Quellmaterial auf die aktuelle Fassung beziehen (präzise, bis auf Absatz und Satz); Sachaussagen der Folien sonst unverändert übernehmen.
- Materielles Recht (Stoff des Ersten Examens) wird als bekannt vorausgesetzt. Folien, die materielle Inhalte nur zur Veranschaulichung nennen (z. B. Arten von Einwendungen und Einreden), werden allenfalls in einer Karte dazu verwertet, was in der jeweiligen Station zu prüfen ist.
- Das Zulässigkeitsschema und die einzelnen Zulässigkeitsvoraussetzungen sind aus dem Ersten Examen bekannt und werden nicht abgefragt, auch nicht gebündelt. Abgefragt werden nur Einzelheiten der jeweiligen Punkte und der prozessuale Umgang (z. B. doppelrelevante Tatsachen, Heilung von Mängeln), soweit das Quellmaterial sie behandelt.
- Dopplungen mit bereits vorhandenen Karten vermeiden: Vor dem Erstellen prüfen, ob der Inhalt schon abgefragt wird; neue Aspekte ggf. in die Erklärung der vorhandenen Karte aufnehmen (dann diese Karte als geändert mit ausgeben).
- Keine zu grundlegenden Karten (z. B. Zweck der Parteivernehmung, Grundprinzip der Relationstechnik, Definition des Beweisantritts). Abgefragt wird, was im Zweiten Examen nicht selbstverständlich ist.
- Jede Frage muss ohne Ansicht der Antwortmöglichkeiten sinnvoll beantwortbar sein (Karteikartenmodus). Keine Fragen wie „Welche Formulierung/Aussage ist richtig?“; stattdessen den abgefragten Punkt in der Frage benennen (z. B. „Wie ist der Beginn beantragter Prozesszinsen im Tenor zu bezeichnen?“).
- Falsche Antworten dürfen nicht in einem vertretbaren Verständnis zutreffen (z. B. eine Parteivernehmung „von Amts wegen“ als falsche Antwort, obwohl § 448 ZPO sie zulässt).
- Fachbegriffe exakt verwenden (z. B. „Replikstation“ statt „Replik“, „vor der mündlichen Verhandlung“ statt „ohne mündliche Verhandlung“, wenn § 358a ZPO gemeint ist).
- Parteineutral formulieren, wo eine Regel für beide Parteien gilt („Wille der Partei“, nicht „des Klägers“).
- Den Gegenstand der Frage inhaltlich benennen, nicht nur per Norm („Antrag auf schriftliche Begutachtung vor Anhängigkeit (§ 485 II ZPO)“, nicht nur „Antrag nach § 485 II ZPO“).
- Die Frage so fassen, dass keine falsche Antwort über eine andere Norm oder Konstellation doch zutrifft (z. B. Vernehmung der beweispflichtigen Partei: § 447 ZPO auf Antrag, aber auch § 448 ZPO von Amts wegen). Notwendige Prämissen gehören in die Frage (z. B. „streitige Haupttatsache“), damit eine falsche Antwort nicht mit einer ohnehin gegebenen Bedingung spielt.
- Bei Fallgruppen-Zuordnungen klarstellen, dass nach der Zuordnung gefragt ist, wenn die Einzelbeispiele im Ergebnis gleich behandelt werden (z. B. alle Fallgruppen führen zur Ablehnung des Beweisantrags).
- Falsche Antworten dürfen gern kniffliger sein, damit sich die Lösung aus Wissen und nicht aus logischem Ausschluss ergibt; weiterhin keine Finten und keine extreme Ähnlichkeit, insbesondere bei Zahlen.
- Kartenzahl nicht ausufern lassen: jede relevante Information verwerten, aber keine redundanten Karten.
- Bleiben Fragen offen, die dazu führen, dass eine Information nicht verwertet werden kann, diese im Chat dem Nutzer vorlegen.

## Priorität (`prio`)

- `hoch` für ca. 25 % der Karten: Inhalte von besonderer Bedeutung für das Examen und/oder besondere, aber grundsätzliche Punkte (z. B. Klausurtechnik, zentrale Abgrenzungen, Beweismaß).
- `niedrig` für ca. 25 %: nur einfachste Informationen oder für das Zweite Examen wenig wichtige Nischenthemen.
- `normal` für den Rest (Standard).
- Maßstab ist allein der Inhalt; die Prozentwerte sind Richtwerte, keine festen Grenzen.

- Zusätzlich gilt: Wissen, das Klausuren und/oder den Aktenvortrag betrifft, ist vorwiegend `hoch` oder `normal`. Wissen, das in typische Klausuren oder Aktenvorträge des Zweiten Examens schon schematisch nicht hineinpasst und nur für mündliche Nachfragen taugt (insbesondere Einzelheiten zum Ablauf der mündlichen Verhandlung und sonstige Praxisdetails), ist vorwiegend `normal` oder `niedrig`; `hoch` nur bei wirklich wichtigem Wissen.

## Kartenformat „Begriffe“

- Verlangt die Antwort eine bloße Aufzählung (Schema, Ablauf, Prüfungsreihenfolge, Liste von Beispielen, Voraussetzungen oder Merkmalen), ist das Format „Begriffe“ nach `docs/KARTEN-VORLAGE-BEGRIFFE.md` zu verwenden.
- `reihenfolge: true`, wenn die Reihenfolge Lerninhalt ist (Schemata, Abläufe, Aufbau); sonst `false`.
- Richtige Begriffe knapp als Stichworte; je nach Anzahl der richtigen Begriffe etwa zwei bis vier falsche Begriffe, knifflig, aber keine Finte (keine bloßen Umformulierungen richtiger Begriffe, keine Begriffe, die in anderer Lesart ebenfalls richtig wären).
- Keine Begriffe-Karten, die nur abstrakte Gruppen- oder Kategoriebezeichnungen abfragen (z. B. „Allgemeine Merkmale, spezielle Inhalte …“); abgefragt werden die Inhalte selbst.
- Zuordnungen (A: x; B: y) und Gegenüberstellungen bleiben normale Karten mit vier Antworten.

## Kontrolle vor der Ausgabe

- Gültiges JSON?
- `gebiet` eines der vier erlaubten Werte?
- `prio` gesetzt (`hoch`/`normal`/`niedrig`), Verteilung ca. 25/50/25?
- Keine Finten unter den falschen Antworten?
- Genau 4 Antworten, Index 0 richtig?
- Erklärung nennt eine Norm oder einen klaren Grund?
- Frage inhaltlich korrekt und examensnah?
- Bei Quellmaterial: alle relevanten Informationen verwertet, nichts hinzuerfunden?

## Wie es weitergeht (nur zu deiner Information, nicht Teil des Auftrags)

In der nächsten Claude-Code-Sitzung vergibt der Assistent die nächste freie
Nummer je Rechtsgebiet (z. B. `strafrecht-0004`), legt die Datei unter
`content/<gebiet>/` ab, prüft den Inhalt stichprobenartig, baut den Index neu
(`node tools/build-index.mjs`) und validiert ihn (`node tools/validate.mjs`).
