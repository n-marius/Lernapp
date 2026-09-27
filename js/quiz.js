// Frage-Antwort-Modus: Frage + 4 gemischte Antworten (A–D), sofortige
// Rückmeldung, danach die Erklärung und ein „Weiter"-Button.
// Vorbild: ukr-app js/quiz.js (Mischen, Raster), hier auf eine Karte je Ansicht
// und mit Erklärungsfeld erweitert.
import { escapeHtml, shuffle } from "./tokens.js";

const KEYS = ["A", "B", "C", "D"];

function creatorChip(card) {
  if (!card.creator) return "";
  const name = card.creator === "marius" ? "Marius" : "Agnessa";
  return `<span class="creator-chip" data-user="${card.creator}"><span class="user-dot-sm"></span>${name}</span>`;
}

// Rendert eine Frage-Antwort-Karte in `container`. Löst das zurückgegebene
// Promise mit `true`/`false` (richtig gewählt), sobald „Weiter" gedrückt wird.
export function renderQuizCard(container, card) {
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
      <div class="next-wrap" hidden id="next-wrap">
        <button type="button" class="btn btn-primary" id="next">Weiter</button>
      </div>
    </div>`;

  const answersEl = container.querySelector("#answers");
  const buttons = [...answersEl.querySelectorAll(".answer")];

  return new Promise((resolve) => {
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
        const nextWrap = container.querySelector("#next-wrap");
        nextWrap.hidden = false;
        container.querySelector("#next").addEventListener("click", () => resolve(isCorrect), { once: true });
      });
    }
  });
}
