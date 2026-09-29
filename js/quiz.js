// Frage-Antwort-Modus: Frage, darunter die 4 Antworten in voller Breite
// untereinander, sofortige Rückmeldung, danach klappt die Erklärung unter
// der richtigen Antwort aus. Der „Weiter"/„Auflösen"-Knopf sitzt fest am
// unteren Bildschirmrand (siehe js/app.js showQuizMode) – dafür meldet diese
// Funktion die Auswahl (oder das erzwungene Auflösen) über `onAnswered`.
import { escapeHtml, shuffle, prioChip, updatePrioChip } from "./tokens.js";
import { nextPrio } from "./store.js";

const KEYS = ["A", "B", "C", "D"];

function creatorChip(card) {
  if (!card.creator) return "";
  const name = card.creator === "marius" ? "Marius" : "Agnessa";
  return `<span class="creator-chip" data-user="${card.creator}"><span class="user-dot-sm"></span>${name}</span>`;
}

function stufeLabel(stufe) {
  return stufe ? `<span class="level-chip">Stufe ${stufe}</span>` : "";
}

function showExplain(card, buttons) {
  if (!card.erklaerung) return;
  const correctBtn = buttons.find((b) => b.dataset.opt === "0");
  const explain = document.createElement("div");
  explain.className = "quiz-explain";
  explain.textContent = card.erklaerung;
  correctBtn.classList.add("has-explain");
  correctBtn.after(explain);
}

// Rendert eine Frage-Antwort-Karte in `container`. Ruft `onAnswered({ correct,
// chosenIndex, order, gaveUp })` genau einmal auf, sobald eine Antwort
// gewählt oder (siehe Rückgabewert `giveUp()`) aufgelöst wurde. `prio`/
// `onPrioChange`: siehe js/cards.js renderFlashcard (identisches
// Prio-Symbol). `stufe` (nur Automatikmodus) zeigt die aktuelle Stufe klein
// darüber. Rückgabewert `{ giveUp }`: löst die Karte ohne Auswahl auf (für
// den „Auflösen"-Knopf in js/app.js, bevor eine Antwort gewählt wurde).
export function renderQuizCard(container, card, { onAnswered, prio = "normal", onPrioChange, stufe } = {}) {
  const order = shuffle([0, 1, 2, 3]);

  container.innerHTML = `
    <div class="q">
      <div class="q-text">${stufeLabel(stufe)}<span class="card-meta">${creatorChip(card)}${prioChip(prio)}</span>${escapeHtml(card.frage)}</div>
      <div class="answers" id="answers">
        ${order.map((optIndex, pos) => `
          <button type="button" class="answer" data-opt="${optIndex}">
            <span class="answer-key">${KEYS[pos]}</span>
            <span>${escapeHtml(card.antworten[optIndex])}</span>
          </button>`).join("")}
      </div>
    </div>`;

  const prioBtn = container.querySelector(".prio-btn");
  prioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = nextPrio(prioBtn.dataset.prio);
    updatePrioChip(prioBtn, next);
    onPrioChange?.(next);
  });

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
      showExplain(card, buttons);
      onAnswered?.({ correct: isCorrect, chosenIndex: chosen, order });
    });
  }

  return {
    giveUp() {
      if (done) return;
      done = true;
      answersEl.classList.add("is-done");
      for (const b of buttons) {
        if (b.dataset.opt === "0") b.classList.add("is-correct");
        b.disabled = true;
      }
      showExplain(card, buttons);
      onAnswered?.({ correct: false, chosenIndex: null, order, gaveUp: true });
    },
  };
}

// Zeigt eine Frage-Antwort-Karte schreibgeschützt in genau dem Zustand, in
// dem sie zuletzt beantwortet (oder aufgelöst) wurde – für „Zurück" in
// js/app.js. Keine Klick-Handler auf den Antworten, nur Prio bleibt änderbar.
export function renderQuizCardReview(container, card, { chosenIndex, order, prio = "normal", onPrioChange } = {}) {
  container.innerHTML = `
    <div class="q">
      <div class="q-text"><span class="card-meta">${creatorChip(card)}${prioChip(prio)}</span>${escapeHtml(card.frage)}</div>
      <div class="answers is-done" id="answers">
        ${order.map((optIndex, pos) => `
          <button type="button" class="answer${optIndex === 0 ? " is-correct" : optIndex === chosenIndex ? " is-wrong" : ""}" data-opt="${optIndex}" disabled>
            <span class="answer-key">${KEYS[pos]}</span>
            <span>${escapeHtml(card.antworten[optIndex])}</span>
          </button>`).join("")}
      </div>
    </div>`;

  const prioBtn = container.querySelector(".prio-btn");
  prioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = nextPrio(prioBtn.dataset.prio);
    updatePrioChip(prioBtn, next);
    onPrioChange?.(next);
  });

  const buttons = [...container.querySelectorAll(".answer")];
  showExplain(card, buttons);
}
