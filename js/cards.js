// Karteikarten-Modus: Anzeige einer Karte (Frage → Antwort → Erklärung → Bewertung)
// und die Warteschlangen-Logik, die sich auch der Frage-Antwort-Modus teilt.
import { escapeHtml } from "./tokens.js";
import { cardKey } from "./store.js";

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

// ---------- Automatikmodus: gewichtete Wiederholung ----------
//
// Statt einer festen Stufe zieht der Automatikmodus bei jeder Karte neu aus
// dem gesamten Rechtsgebiet – gewichtet nach drei Faktoren, die miteinander
// multipliziert werden (üblicher Ansatz bei Lernkarteien wie Anki: mehrere
// unabhängige Gewichte kombinieren statt eine einzelne Formel zu erfinden):
//
// 1. Stufe: jede Stufe wiegt nur noch ein Drittel der vorherigen (Faktor 3),
//    sodass Stufe 5 nur 1/81 des Gewichts von Stufe 1 hat – „kaum noch dran“.
// 2. Zeit seit der letzten Bearbeitung: wächst von einem kleinen Sockelwert
//    (eine gerade erst beantwortete Karte soll nicht sofort wiederkommen)
//    über etwa 24 Stunden auf annähernd das volle Gewicht zu (exponentielle
//    Sättigung – das übliche Modell für „je länger her, desto fälliger").
// 3. Nie bearbeitete Karten bekommen einen festen Bonus, damit neue Karten
//    zügig auftauchen, statt lange unten in der Warteschlange zu bleiben.
const AUTO_STUFE_WEIGHT = { 1: 81, 2: 27, 3: 9, 4: 3, 5: 1 };
const AUTO_NEVER_SEEN_BONUS = 3;
const AUTO_RECENCY_FLOOR = 0.05;
const AUTO_RECENCY_HALFLIFE_HOURS = 24;

function autoCardWeight(card, levelsByCard, now) {
  const level = levelsByCard.get(cardKey(card));
  const stufe = level?.stufe ?? 1;
  const stufeWeight = AUTO_STUFE_WEIGHT[stufe] ?? 1;
  if (!level?.ts) return stufeWeight * AUTO_NEVER_SEEN_BONUS;
  const hoursSince = (now - new Date(level.ts).getTime()) / 3_600_000;
  const recency = AUTO_RECENCY_FLOOR + (1 - AUTO_RECENCY_FLOOR) * (1 - Math.exp(-hoursSince / AUTO_RECENCY_HALFLIFE_HOURS));
  return stufeWeight * recency;
}

// Zieht eine Karte gewichtet zufällig aus `pool`. `excludeKey` (die zuletzt
// gezogene Karte) wird ausgeschlossen, solange noch andere Karten übrig sind,
// damit dieselbe Karte nicht zweimal hintereinander erscheint.
export function pickWeightedCard(pool, levelsByCard, excludeKey) {
  const candidates = pool.length > 1 ? pool.filter((c) => cardKey(c) !== excludeKey) : pool;
  const now = Date.now();
  const weights = candidates.map((c) => autoCardWeight(c, levelsByCard, now));
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

// Rendert eine einzelne Karteikarte in `container` (Frage, dann nach Antippen
// die Antwort + Erklärung). Die Falsch/Richtig-Knöpfe sitzen fest am unteren
// Bildschirmrand (siehe js/app.js showFlashcardMode) und werden erst nach dem
// Aufdecken aktiv – dafür meldet diese Funktion das Aufdecken über `onRevealed`.
export function renderFlashcard(container, card, { onRevealed } = {}) {
  container.innerHTML = `
    <div class="flash">
      <div class="flash-face flash-face-question">
        ${creatorChip(card)}
        <p class="flash-text">${escapeHtml(card.frage)}</p>
      </div>
      <button type="button" class="flash-face is-waiting" id="reveal">
        <p class="flash-answer-wait">Antippen, um die Antwort zu zeigen</p>
      </button>
    </div>`;

  const reveal = container.querySelector("#reveal");
  reveal.addEventListener("click", () => {
    reveal.outerHTML = `
      <div class="flash-face">
        <div>
          <p class="flash-text">${escapeHtml(card.antworten[0])}</p>
          ${card.erklaerung ? `<div class="flash-explain">${escapeHtml(card.erklaerung)}</div>` : ""}
        </div>
      </div>`;
    onRevealed?.();
  }, { once: true });
}
