# Anweisung für Claude Code: Kartenpflege Zivilgericht (Stand 30.09.2026)

Die Karten in der App tragen IDs (`zivilgericht-XXXX`), nicht die Dateinamen aus dem Chat. Zuordnung daher ausschließlich über den **exakten Fragetext** (`frage`). Wird zu einem Fragetext keine Karte gefunden, nichts tun und kurz melden; keine Zuordnung über Stichworte oder Ähnlichkeit.

## 1. Karten löschen

Lösche die Karte, deren `frage` exakt lautet:

- `parteivernehmung_zweck`: Welchem Zweck dient die Parteivernehmung?
- `relationstechnik_grundprinzip`: Was ist das Grundprinzip der Relationstechnik?
- `aufgaben_zivilrichter`: Welche Aufgaben hat der Zivilrichter im Verfahren?
- `ueberlegungen_vor_klage`: Welche Arten von Überlegungen stellt eine Partei vor Klageerhebung an?
- `prozessgrundrechte`: Welche Prozessgrundrechte hat der Zivilrichter zu beachten?
- `prozessgrundsaetze`: Welche Prozessgrundsätze (Prozessmaximen) prägen den Zivilprozess?
- `beweisantritt_begriff`: Was ist ein Beweisantritt?
- `hauptbeweis`: Wann ist der Hauptbeweis geführt?
- `beweis_entbehrlich_nicht_erheblich`: Ist über nicht entscheidungserhebliche Tatsachen Beweis zu erheben?

## 2. Karten ersetzen (ZIP `Karten_Update_2026-09-30.zip`)

Jede Datei der ZIP ersetzt die Karte mit dem unten genannten **bisherigen** Fragetext (ID beibehalten, Inhalt vollständig durch die neue Datei ersetzen). Dateien mit `"typ": "begriffe"` nutzen das neue Begriffe-Format; die Felder der alten Karte (insb. die vier `antworten`) werden dabei vollständig ersetzt. Danach `node tools/validate.mjs` ausführen.

- `zivilgericht_ablauf_muendliche_verhandlung.txt` ersetzt: Wie läuft die mündliche Verhandlung ab?
- `zivilgericht_ablehnung_fallgruppen.txt` ersetzt: Welche drei Fallgruppen der Ablehnung von Beweisanträgen gibt es?
- `zivilgericht_ablehnung_nicht_ordnungsgemaess.txt` ersetzt: Welche Beispiele nennt die Fallgruppe „nicht ordnungsgemäßer Beweisantrag“?
- `zivilgericht_ablehnung_unzulaessig.txt` ersetzt: Welche Beispiele gehören zur Fallgruppe „unzulässige Beweisaufnahme“?
- `zivilgericht_abwendungsbefugnis_711.txt` ersetzt: Wann ist eine Abwendungsbefugnis nach § 711 ZPO auszusprechen?
- `zivilgericht_aktenauszug_inhalt.txt` ersetzt: Was wird im Aktenauszug erfasst?
- `zivilgericht_anordnung_beweisaufnahme.txt` ersetzt: Setzt jede Beweisaufnahme eine gerichtliche Anordnung voraus?
- `zivilgericht_anordnung_ohne_mv.txt` ersetzt: Welche Anordnungsformen gibt es für eine Beweisaufnahme ohne mündliche Verhandlung?
- `zivilgericht_arten_bestreiten.txt` ersetzt: Welche Arten des Bestreitens gibt es?
- `zivilgericht_auslegung_antrag_massstab.txt` ersetzt: Nach welchem Maßstab werden Prozessanträge ausgelegt?
- `zivilgericht_aussagewuerdigung_schritte.txt` ersetzt: In welchen Schritten wird eine Zeugenaussage gewürdigt?
- `zivilgericht_beweis_entbehrlich_indizien.txt` ersetzt: Ist über eine Haupttatsache Beweis zu erheben, wenn unstreitige oder bewiesene Indizien ihr Vorliegen belegen?
- `zivilgericht_beweis_entbehrlich_unwirksames_bestreiten.txt` ersetzt: In welchen Fällen ist Bestreiten nicht wirksam, sodass keine Beweisaufnahme erfolgt?
- `zivilgericht_beweisbeschluss_inhalt_359.txt` ersetzt: Was enthält ein förmlicher Beweisbeschluss (§ 359 ZPO)?
- `zivilgericht_beweisstation_fragen.txt` ersetzt: Welche Fragen stellt die Beweisstation?
- `zivilgericht_beweiswuerdigung_gliederung.txt` ersetzt: Wie ist die Beweiswürdigung zu gliedern?
- `zivilgericht_bindungswirkung_darlegungsstationen.txt` ersetzt: Wann ist die Sach- und Rechtslage in Kläger- und Beklagtenstation nicht voll zu prüfen?
- `zivilgericht_formeller_beweisbeschluss_358.txt` ersetzt: Welche „besonderen Beweisverfahren“ erfordern nach § 358 ZPO einen formellen Beweisbeschluss?
- `zivilgericht_formeller_beweisbeschluss_faelle.txt` ersetzt: Wann muss ein formeller Beweisbeschluss (§ 359 ZPO) ergehen?
- `zivilgericht_glaubhaftmachung_anwendungsfaelle.txt` ersetzt: In welchen Verfahren genügt u. a. Glaubhaftmachung?
- `zivilgericht_parteivernehmung_445.txt` ersetzt: Unter welchen Voraussetzungen ist die Vernehmung des Gegners nach § 445 I ZPO zulässig?
- `zivilgericht_parteivernehmung_447.txt` ersetzt: Unter welchen Voraussetzungen kann die beweispflichtige Partei selbst vernommen werden (§ 447 ZPO)?
- `zivilgericht_realitaetskennzeichen_allgemein.txt` ersetzt: Welche allgemeinen Merkmale sind Realitätskennzeichen?
- `zivilgericht_realitaetskennzeichen_kategorien.txt` ersetzt: In welche Gruppen lassen sich Realitätskennzeichen einteilen?
- `zivilgericht_realitaetskennzeichen_motivation.txt` ersetzt: Welche motivationsbezogenen Inhalte sind Realitätskennzeichen?
- `zivilgericht_realitaetskennzeichen_speziell.txt` ersetzt: Welche speziellen Inhalte sind Realitätskennzeichen?
- `zivilgericht_relation_stationen.txt` ersetzt: In welcher Reihenfolge werden die Stationen der Relation geprüft?
- `zivilgericht_replik_vermeiden.txt` ersetzt: Wie lässt sich eine Replik vermeiden?
- `zivilgericht_sbv_485_abs1_abs2.txt` ersetzt: Wie unterscheiden sich Beweissicherung (§ 485 I ZPO) und selbständiges Beweisverfahren nach § 485 II ZPO?
- `zivilgericht_sbv_antrag_inhalt_487.txt` ersetzt: Was muss der Antrag im selbständigen Beweisverfahren enthalten (§ 487 ZPO)?
- `zivilgericht_sbv_rechtliches_interesse.txt` ersetzt: Fehlt das rechtliche Interesse (§ 485 II ZPO), wenn der Antragsgegner erklärt, ohnehin nicht freiwillig zu zahlen?
- `zivilgericht_sbv_zustaendigkeit.txt` ersetzt: An welches Gericht ist ein Antrag nach § 485 II ZPO vor Anhängigkeit zu richten?
- `zivilgericht_sicherheitsleistung_bemessung.txt` ersetzt: Wie wird eine betragsmäßige Sicherheit nach § 709 S. 1 ZPO bemessen?
- `zivilgericht_streitig_unstreitig.txt` ersetzt: Wann ist Parteivorbringen unstreitig?
- `zivilgericht_strengbeweis_beweismittel.txt` ersetzt: Auf welche Beweismittel ist der Strengbeweis beschränkt?
- `zivilgericht_tatbestand_aufbau.txt` ersetzt: Wie ist der Tatbestand aufgebaut?
- `zivilgericht_tatbestand_beklagtenvortrag_reihenfolge.txt` ersetzt: In welcher Reihenfolge wird der streitige Beklagtenvortrag dargestellt?
- `zivilgericht_tatbestand_formulierung.txt` ersetzt: Welche Grundsätze gelten für die Formulierung des Tatbestands?
- `zivilgericht_tenor_bestandteile.txt` ersetzt: Aus welchen Teilen besteht der Urteilstenor?
- `zivilgericht_ueberzeugungskraft_sachverstaendiger.txt` ersetzt: Was ist bei der Überzeugungskraft eines Sachverständigengutachtens zu prüfen?
- `zivilgericht_ueberzeugungskraft_urkunde.txt` ersetzt: Was ist bei der Würdigung einer Urkunde zu prüfen?
- `zivilgericht_unzulaessige_fragen.txt` ersetzt: Wann ist eine Frage an den Zeugen unzulässig?
- `zivilgericht_urkunde_pruefung.txt` ersetzt: Wie ist der Urkundsbeweis zu prüfen?
- `zivilgericht_vollstreckbarkeit_708_nr11.txt` ersetzt: Wann ist ein Urteil nach § 708 Nr. 11 ZPO ohne Sicherheitsleistung vorläufig vollstreckbar?
- `zivilgericht_warnsignale_aussageverhalten.txt` ersetzt: Welche Warnsignale im Aussageverhalten gibt es?
- `zivilgericht_warnsignale_inhaltlich.txt` ersetzt: Welche inhaltlichen Warnsignale gibt es bei Zeugenaussagen?
- `zivilgericht_zeuge_fragereihenfolge.txt` ersetzt: In welcher Reihenfolge wird der Zeuge befragt?
- `zivilgericht_zeugenvernehmung_ablauf.txt` ersetzt: Wie läuft die Zeugenvernehmung ab?
- `zivilgericht_zulaessigkeit_schema.txt` ersetzt: In welche Gruppen gliedern sich die Zulässigkeitsvoraussetzungen?
- `zivilgericht_zustellung_mindestanforderungen.txt` ersetzt: Welche formellen Mindestanforderungen muss die Klageschrift für die Zustellung erfüllen?

## 3. Nur Priorität ändern

Bei diesen Karten nur das Feld `prio` ändern, sonst nichts:

- Was gilt nach § 395 ZPO für Belehrung und Vernehmung zur Person? → `normal` (bisher `hoch`)
- Wann besteht ein Zeugnisverweigerungsrecht wegen Verwandtschaft oder Schwägerschaft (§ 383 I Nr. 3 ZPO)? → `normal` (bisher `hoch`)
- Was darf und muss das Gericht prüfen, bevor es die Zustellung der Klage veranlasst? → `normal` (bisher `hoch`)
- Wie wird schriftsätzlicher Vortrag regelmäßig zum Gegenstand der mündlichen Verhandlung? → `normal` (bisher `hoch`)
- Ein geladener Zeuge ist nicht erschienen. Was ist zu veranlassen? → `niedrig` (bisher `normal`)
- Muss eine Zeugenaussage protokolliert werden? → `niedrig` (bisher `normal`)
- Wie ist der Zeuge zur Sache zu vernehmen (§ 396 ZPO)? → `niedrig` (bisher `normal`)
- Eine Partei beanstandet eine Frage an den Zeugen. Wer entscheidet wie? → `niedrig` (bisher `normal`)
- Der Zeuge verweigert die Aussage. Wie wird darüber entschieden? → `niedrig` (bisher `normal`)
- Wie ist die Partei vor ihrer Vernehmung zu ermahnen und (sinnvollerweise) zu belehren? → `niedrig` (bisher `normal`)
- Ist für die Parteivernehmung ein Beweisbeschluss erforderlich, und an wen ist zu laden? → `niedrig` (bisher `normal`)
- Ist die uneidliche Falschaussage einer Partei bei der Parteivernehmung nach § 153 StGB strafbar? → `niedrig` (bisher `normal`)
