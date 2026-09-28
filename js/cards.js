// Karteikarten-Modus: Anzeige einer Karte (Frage → Antwort → Erklärung → Bewertung)
// und die Warteschlangen-Logik, die sich auch der Frage-Antwort-Modus teilt.
import { escapeHtml, prioChip, updatePrioChip } from "./tokens.js";
import { cardKey, effectivePrio, nextPrio } from "./store.js";

// Baut die Warteschlange für ein Rechtsgebiet und eine Stufe: alle Karten,
// die aktuell (für diesen Nutzer) in dieser Stufe stehen, aufsteigend nach dem
// Zeitpunkt des letzten Stufenwechsels sortiert (zuletzt gewechselte Karten
// stehen am Ende). Karten ohne eigenen Stufenwechsel gelten als Stufe 1 mit
// ihrem Anlage-Zeitpunkt als Sortierschlüssel.
//
// `allCards` sollte bereits über store.applyOverridesAndFilter gelaufen sein
// (Korrekturen angewendet, gelöschte und offen gemeldete Karten entfernt) –
// diese Funktion dupliziert diese Logik nicht.
export function buildQueue(allCards, gebiet, stufe, levelsByCard) {
  return allCards
    .filter((c) => c.gebiet === gebiet)
    .map((c) => {
      const level = levelsByCard.get(cardKey(c));
      return { card: c, stufe: level?.stufe ?? 1, ts: level?.ts ?? c.ts };
    })
    .filter((entry) => entry.stufe === stufe)
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
    .map((entry) => entry.card);
}

export function countByStufe(allCards, gebiet, levelsByCard) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of allCards.filter((c) => c.gebiet === gebiet)) {
    const level = levelsByCard.get(cardKey(c));
    const stufe = level?.stufe ?? 1;
    counts[stufe]++;
  }
  return counts;
}

export function countByGebiet(allCards) {
  const counts = {};
  for (const c of allCards) counts[c.gebiet] = (counts[c.gebiet] ?? 0) + 1;
  return counts;
}

// Filtert nach der für den Nutzer geltenden Prio (Prio-Filter oberhalb der
// Rechtsgebietswahl, siehe SPEC.md Abschnitt 5). Sind alle drei Prios aktiv
// (Normalzustand beim Öffnen der Seite), wird nicht gefiltert.
export function filterByPrio(cards, priosByCard, allowedPrios) {
  if (!allowedPrios || allowedPrios.size >= 3) return cards;
  return cards.filter((c) => allowedPrios.has(effectivePrio(c, priosByCard)));
}

// ---------- Automatikmodus: gewichtete Wiederholung ----------
//
// Statt einer festen Stufe zieht der Automatikmodus bei jeder Karte neu aus
// dem gesamten Rechtsgebiet – gewichtet nach vier Faktoren, die miteinander
// multipliziert werden (üblicher Ansatz bei Lernkarteien wie Anki: mehrere
// unabhängige Gewichte kombinieren statt eine einzelne Formel zu erfinden):
//
// 1. Stufe: jede Stufe wiegt nur noch ein Drittel der vorherigen (Faktor 3),
//    sodass Stufe 5 nur 1/81 des Gewichts von Stufe 1 hat – „kaum noch dran“.
//    Die Stufe ist modusübergreifend (Karteikarten und Frage-Antwort teilen
//    sich denselben Fortschritt), eine Bearbeitung im manuellen Modus wirkt
//    also unmittelbar auch auf die Automatik.
// 2. Zeit seit der letzten Bearbeitung (ebenfalls modusübergreifend, siehe
//    oben): Bei tausenden Karten reicht die schiere Menge bereits für eine
//    natürliche Verteilung (FIFO), daher bleibt das Gewicht zunächst niedrig
//    und steigt erst über mehrere Wochen spürbar an. Verwendet wird eine
//    Weibull-Verteilung (in Zuverlässigkeits-/Wartungsmodellen der übliche
//    Ansatz für „verzögert einsetzende, dann beschleunigende" Kurven, die
//    sich asymptotisch 100 % annähert, ohne je darüber hinauszugehen):
//    nach 1 Tag ca. 7 %, nach 3 Tagen ca. 20 %, nach 1 Woche ca. 45 %, nach
//    2 Wochen ca. 75 %, nach 1 Monat ca. 97 % des vollen Gewichts.
// 3. Nie bearbeitete Karten bekommen einen festen Bonus, damit neue Karten
//    zügig auftauchen, statt lange unten in der Warteschlange zu bleiben.
// 4. Prio (siehe SPEC.md Abschnitt 5.1a): „hoch“ wird moderat auf-, „niedrig“
//    moderat abgewichtet. Die persönliche Prio-Änderung eines Nutzers wirkt
//    sich nur auf dessen eigene Automatik aus (siehe `effectivePrio`).
const AUTO_STUFE_WEIGHT = { 1: 81, 2: 27, 3: 9, 4: 3, 5: 1 };
const AUTO_NEVER_SEEN_BONUS = 3;
const AUTO_PRIO_WEIGHT = { hoch: 1.5, normal: 1, niedrig: 0.6 };
const AUTO_RECENCY_FLOOR = 0.02;
const AUTO_RECENCY_TAU_HOURS = 260; // Skalenparameter der Weibull-Kurve
const AUTO_RECENCY_SHAPE = 1.25; // Formparameter: >1 = langsamer Start, dann Beschleunigung, hier flach auslaufend

function autoRecencyWeight(hoursSince) {
  const x = Math.max(hoursSince, 0) / AUTO_RECENCY_TAU_HOURS;
  const raw = 1 - Math.exp(-Math.pow(x, AUTO_RECENCY_SHAPE));
  return AUTO_RECENCY_FLOOR + (1 - AUTO_RECENCY_FLOOR) * raw;
}

function autoCardWeight(card, levelsByCard, priosByCard, now) {
  const level = levelsByCard.get(cardKey(card));
  const stufe = level?.stufe ?? 1;
  const stufeWeight = AUTO_STUFE_WEIGHT[stufe] ?? 1;
  const prioWeight = AUTO_PRIO_WEIGHT[effectivePrio(card, priosByCard)] ?? 1;
  if (!level?.ts) return stufeWeight * AUTO_NEVER_SEEN_BONUS * prioWeight;
  const hoursSince = (now - new Date(level.ts).getTime()) / 3_600_000;
  return stufeWeight * autoRecencyWeight(hoursSince) * prioWeight;
}

// Zieht eine Karte gewichtet zufällig aus `pool`. `excludeKey` (die zuletzt
// gezogene Karte) wird ausgeschlossen, solange noch andere Karten übrig sind,
// damit dieselbe Karte nicht zweimal hintereinander erscheint.
export function pickWeightedCard(pool, levelsByCard, priosByCard, excludeKey) {
  const candidates = pool.length > 1 ? pool.filter((c) => cardKey(c) !== excludeKey) : pool;
  const now = Date.now();
  const weights = candidates.map((c) => autoCardWeight(c, levelsByCard, priosByCard, now));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function creatorChip(card) {
  if (!card.creator) return "";
  const name = card.creator === "marius" ? "Marius" : "Agnessa";
  return `<span class="creator-chip" data-user="${card.creator}"><span class="user-dot-sm"></span>${name}</span>`;
}

function stufeLabel(stufe) {
  return stufe ? `<span class="level-chip">Stufe ${stufe}</span>` : "";
}

// Rendert eine einzelne Karteikarte in `container` (Frage, dann nach Antippen
// die Antwort + Erklärung). Die Falsch/Richtig-Knöpfe sitzen fest am unteren
// Bildschirmrand (siehe js/app.js showFlashcardMode) und werden erst nach dem
// Aufdecken aktiv – dafür meldet diese Funktion das Aufdecken über `onRevealed`.
// `prio` ist die aktuell für den Nutzer geltende Priorität (siehe
// store.effectivePrio); ein Antippen des Symbols meldet die neue Priorität
// über `onPrioChange` zurück, ohne die Karte neu aufzubauen. `stufe` (nur im
// Automatikmodus gesetzt) zeigt die aktuelle Stufe klein über dem
// Prio-Symbol. `revealed: true` (Rückschau auf die letzte Karte, siehe
// js/app.js „Zurück") zeigt Antwort und Erklärung sofort, ohne Antipp-Schritt
// und ohne `onRevealed` auszulösen.
export function renderFlashcard(container, card, { onRevealed, prio = "normal", onPrioChange, stufe, revealed = false } = {}) {
  const meta = `<div class="card-meta-col">${stufeLabel(stufe)}<span class="card-meta">${creatorChip(card)}${prioChip(prio)}</span></div>`;
  const answerFace = `
      <div class="flash-face">
        <div>
          <p class="flash-text">${escapeHtml(card.antworten[0])}</p>
          ${card.erklaerung ? `<div class="flash-explain">${escapeHtml(card.erklaerung)}</div>` : ""}
        </div>
      </div>`;

  container.innerHTML = `
    <div class="flash">
      <div class="flash-face flash-face-question">
        <div class="flash-q">
          ${meta}
          <p class="flash-text">${escapeHtml(card.frage)}</p>
        </div>
      </div>
      ${revealed ? answerFace : `
      <button type="button" class="flash-face is-waiting" id="reveal">
        <p class="flash-answer-wait">Antippen, um die Antwort zu zeigen</p>
      </button>`}
    </div>`;

  const prioBtn = container.querySelector(".prio-btn");
  prioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = nextPrio(prioBtn.dataset.prio);
    updatePrioChip(prioBtn, next);
    onPrioChange?.(next);
  });

  if (revealed) return;

  const reveal = container.querySelector("#reveal");
  reveal.addEventListener("click", () => {
    reveal.outerHTML = answerFace;
    onRevealed?.();
  }, { once: true });
}
