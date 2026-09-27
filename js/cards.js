// Karteikarten-Modus: Anzeige einer Karte (Frage → Antwort → Erklärung → Bewertung)
// und die Warteschlangen-Logik, die sich auch der Frage-Antwort-Modus teilt.
import { escapeHtml } from "./tokens.js";

// Baut die Warteschlange für ein Rechtsgebiet und eine Stufe: alle Karten,
// die aktuell (für diesen Nutzer) in dieser Stufe stehen, aufsteigend nach dem
// Zeitpunkt des letzten Stufenwechsels sortiert (zuletzt gewechselte Karten
// stehen am Ende). Karten ohne eigenen Stufenwechsel gelten als Stufe 1 mit
// ihrem Anlage-Zeitpunkt als Sortierschlüssel.
export function buildQueue(allCards, gebiet, stufe, levelsByCard) {
  return allCards
    .filter((c) => c.gebiet === gebiet)
    .map((c) => {
      const level = levelsByCard.get(c.id);
      return { card: c, stufe: level?.stufe ?? 1, ts: level?.ts ?? c.ts };
    })
    .filter((entry) => entry.stufe === stufe)
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
    .map((entry) => entry.card);
}

export function countByStufe(allCards, gebiet, levelsByCard) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of allCards.filter((c) => c.gebiet === gebiet)) {
    const level = levelsByCard.get(c.id);
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

function creatorChip(card) {
  if (!card.creator) return "";
  const name = card.creator === "marius" ? "Marius" : "Agnessa";
  return `<span class="creator-chip" data-user="${card.creator}"><span class="user-dot-sm"></span>${name}</span>`;
}

// Rendert eine einzelne Karteikarte in `container`. `onAnswer(correct)` wird
// nach der Bewertung aufgerufen; der Aufrufer kümmert sich um Stufenwechsel,
// Statistik und den Wechsel zur nächsten Karte in der Warteschlange.
export function renderFlashcard(container, card) {
  container.innerHTML = `
    <div class="flash">
      <div class="flash-face flash-face-question">
        ${creatorChip(card)}
        <p class="flash-text">${escapeHtml(card.frage)}</p>
      </div>
      <button type="button" class="flash-face is-waiting" id="reveal">
        <p class="flash-answer-wait">Antippen, um die Antwort zu zeigen</p>
      </button>
      <div class="flash-actions" id="actions" hidden>
        <button type="button" class="btn btn-wrong" id="wrong">Falsch</button>
        <button type="button" class="btn btn-correct" id="richtig">Richtig</button>
      </div>
    </div>`;

  const reveal = container.querySelector("#reveal");
  const actions = container.querySelector("#actions");

  return new Promise((resolve) => {
    reveal.addEventListener("click", () => {
      reveal.outerHTML = `
        <div class="flash-face">
          <div>
            <p class="flash-text">${escapeHtml(card.antworten[0])}</p>
            ${card.erklaerung ? `<div class="flash-explain">${escapeHtml(card.erklaerung)}</div>` : ""}
          </div>
        </div>`;
      actions.hidden = false;
    }, { once: true });

    container.querySelector("#wrong").addEventListener("click", () => resolve(false));
    container.querySelector("#richtig").addEventListener("click", () => resolve(true));
  });
}
