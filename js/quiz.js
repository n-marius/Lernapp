// Frage-Antwort-Modus: Frage, darunter die 4 Antworten in voller Breite
// untereinander, sofortige Rückmeldung, danach klappt die Erklärung unter
// der jeweiligen Antwort aus. Der „Weiter"-Knopf sitzt fest am unteren
// Bildschirmrand (siehe js/app.js showQuizMode) und wird erst nach einer
// Antwort aktiv – dafür meldet diese Funktion die Auswahl über `onAnswered`.
import { escapeHtml, shuffle } from "./tokens.js";

const KEYS = ["A", "B", "C", "D"];

function creatorChip(card) {
  if (!card.creator) return "";
  const name = card.creator === "marius" ? "Marius" : "Agnessa";
  return `<span class="creator-chip" data-user="${card.creator}"><span class="user-dot-sm"></span>${name}</span>`;
}

// Rendert eine Frage-Antwort-Karte in `container`. Ruft `onAnswered(isCorrect)`
// genau einmal auf, sobald eine Antwort gewählt wurde.
export function renderQuizCard(container, card, { onAnswered } = {}) {
  const order = shuffle([0, 1, 2, 3]);

  container.innerHTML = `
    <div class="q">
      <p class="q-text">${creatorChip(card)}${escapeHtml(card.frage)}</p>
      <div class="answers" id="answers">
        ${order.map((optIndex, pos) => `
          <button type="button" class="answer" data-opt="${optIndex}">
            <span class="answer-key">${KEYS[pos]}</span>
            <span>${escapeHtml(card.antworten[optIndex])}</span>
          </button>`).join("")}
      </div>
      <div class="quiz-explain" id="explain" hidden>${escapeHtml(card.erklaerung ?? "")}</div>
    </div>`;

  const answersEl = container.querySelector("#answers");
  const buttons = [...answersEl.querySelectorAll(".answer")];

  let done = false;
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      if (done) return;
      done = true;
      const chosen = Number(btn.dataset.opt);
      const isCorrect = chosen === 0; // antworten[0] ist immer die richtige Antwort
      answersEl.classList.add("is-done");
      for (const b of buttons) {
        const opt = Number(b.dataset.opt);
        if (opt === 0) b.classList.add("is-correct");
        else if (opt === chosen) b.classList.add("is-wrong");
        b.disabled = true;
      }
      if (card.erklaerung) container.querySelector("#explain").hidden = false;
      onAnswered?.(isCorrect);
    });
  }
}
