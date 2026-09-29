// Fragenformat „Begriffe“ (typ: "begriffe"): Die Antwort ist eine Abfolge oder
// Auflistung von Begriffen. Die richtigen Begriffe (`antworten`, in der
// richtigen Reihenfolge) und einige falsche (`falsche`) stehen in zufälliger
// Reihenfolge als anklickbare Kästchen da. `reihenfolge: true` = die Reihenfolge
// zählt (Schema), sonst reine Auflistung. Siehe SPEC.md Abschnitt 5.7.
import { escapeHtml, shuffle, prioChip, updatePrioChip } from "./tokens.js";
import { nextPrio } from "./store.js";

function creatorChip(card) {
  if (!card.creator) return "";
  const name = card.creator === "marius" ? "Marius" : "Agnessa";
  return `<span class="creator-chip" data-user="${card.creator}"><span class="user-dot-sm"></span>${name}</span>`;
}

function stufeLabel(stufe) {
  return stufe ? `<span class="level-chip">Stufe ${stufe}</span>` : "";
}

function metaHtml(card, prio, stufe) {
  return `${stufeLabel(stufe)}<span class="card-meta">${creatorChip(card)}${prioChip(prio)}</span>`;
}

function bindPrio(container, onPrioChange) {
  const prioBtn = container.querySelector(".prio-btn");
  prioBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = nextPrio(prioBtn.dataset.prio);
    updatePrioChip(prioBtn, next);
    onPrioChange?.(next);
  });
}

export const isTermCard = (card) => card.typ === "begriffe";

function setNumber(el, n, bad) {
  const box = el.querySelector(".term-no");
  if (!box) return;
  box.textContent = String(n);
  box.classList.toggle("is-bad", !!bad);
}

// Frage-Antwort-Modus. `replay` ({ order, picks, gaveUp }) baut den Endzustand
// einer früheren Runde schreibgeschützt nach (für „Zurück“).
export function renderTermCard(container, card, { onAnswered, prio = "normal", onPrioChange, stufe, replay } = {}) {
  const ordered = !!card.reihenfolge;
  const n = card.antworten.length;
  const items = [
    ...card.antworten.map((text, i) => ({ text, pos: i + 1 })),
    ...card.falsche.map((text) => ({ text, pos: null })),
  ];
  const order = replay?.order ?? shuffle(items.map((_, i) => i));

  container.innerHTML = `
    <div class="q">
      <div class="q-text">${metaHtml(card, prio, replay ? undefined : stufe)}${escapeHtml(card.frage)}</div>
      <div class="terms${ordered ? " is-ordered" : ""}" id="terms">
        ${order.map((i) => `
          <button type="button" class="term" data-i="${i}">
            ${ordered ? `<span class="term-no"></span>` : ""}
            <span class="term-text">${escapeHtml(items[i].text)}</span>
          </button>`).join("")}
      </div>
    </div>`;
  bindPrio(container, onPrioChange);

  const q = container.querySelector(".q");
  const els = new Map([...container.querySelectorAll(".term")].map((b) => [Number(b.dataset.i), b]));
  const picks = [];
  let done = false;
  let silent = !!replay;

  function finish(correct, gaveUp) {
    done = true;
    for (const [i, el] of els) {
      el.disabled = true;
      if (picks.includes(i)) continue;
      const item = items[i];
      if (item.pos !== null && !correct) {
        el.classList.add("is-correct");
        if (ordered) setNumber(el, item.pos, !gaveUp);
      } else {
        el.classList.add("is-dim");
      }
    }
    if (card.erklaerung) {
      const explain = document.createElement("div");
      explain.className = "terms-explain";
      explain.textContent = card.erklaerung;
      q.appendChild(explain);
    }
    if (!silent) onAnswered?.({ correct, order, picks: [...picks], gaveUp: !!gaveUp });
  }

  function pick(i) {
    if (done || picks.includes(i)) return;
    picks.push(i);
    const k = picks.length;
    const item = items[i];
    const el = els.get(i);
    if (item.pos === null) {
      el.classList.add("is-wrong");
      finish(false);
      return;
    }
    el.classList.add("is-correct");
    if (!ordered) {
      if (picks.filter((p) => items[p].pos !== null).length === n) finish(true);
      return;
    }
    setNumber(el, item.pos, item.pos !== k);
    if (item.pos !== k) finish(false);
    else if (k === n) finish(true);
  }

  for (const [i, el] of els) el.addEventListener("click", () => pick(i));

  function giveUp() {
    if (!done) finish(false, true);
  }

  if (replay) {
    for (const i of replay.picks ?? []) pick(i);
    if (replay.gaveUp) giveUp();
    silent = false;
  }

  return { giveUp };
}

export function renderTermCardReview(container, card, { result, prio = "normal", onPrioChange } = {}) {
  renderTermCard(container, card, {
    prio,
    onPrioChange,
    replay: { order: result.order, picks: result.picks, gaveUp: result.gaveUp },
  });
}

// Karteikarten-Modus: die richtigen Begriffe in richtiger Reihenfolge, zunächst
// verdeckt; jedes Kästchen wird einzeln umgedreht. Erst wenn alle aufgedeckt
// sind, erscheint die Erklärung und `onRevealed` schaltet Richtig/Falsch frei.
export function renderTermFlash(container, card, { onRevealed, prio = "normal", onPrioChange, stufe, revealed = false } = {}) {
  const ordered = !!card.reihenfolge;
  const explain = card.erklaerung ? `<div class="flash-explain">${escapeHtml(card.erklaerung)}</div>` : "";

  container.innerHTML = `
    <div class="flash">
      <div class="flash-face flash-face-question">
        <div class="flash-q">
          ${metaHtml(card, prio, stufe)}
          <p class="flash-text">${escapeHtml(card.frage)}</p>
        </div>
      </div>
      <div class="flash-face flash-face-terms${revealed ? "" : " is-waiting"}">
        <div class="terms is-flash${ordered ? " is-ordered" : ""}" id="terms">
          ${card.antworten.map((text, i) => `
            <button type="button" class="term${revealed ? "" : " is-covered"}" ${revealed ? "disabled" : ""}>
              ${ordered ? `<span class="term-no">${i + 1}</span>` : ""}
              <span class="term-text">${revealed ? escapeHtml(text) : "Antippen"}</span>
            </button>`).join("")}
        </div>
        <div id="terms-explain">${revealed ? explain : ""}</div>
      </div>
    </div>`;
  bindPrio(container, onPrioChange);
  if (revealed) return;

  const buttons = [...container.querySelectorAll(".term")];
  let open = 0;
  buttons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      btn.classList.remove("is-covered");
      btn.querySelector(".term-text").textContent = card.antworten[i];
      btn.disabled = true;
      open++;
      if (open === buttons.length) {
        container.querySelector(".flash-face-terms").classList.remove("is-waiting");
        container.querySelector("#terms-explain").innerHTML = explain;
        onRevealed?.();
      }
    }, { once: true });
  });
}
