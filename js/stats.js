// Statistik: tägliche Anzahl bearbeiteter Karten (Karteikarten + Frage-Antwort
// zusammen) als kleines Liniendiagramm, x-Achse = Tage.
// Vorbild: ukr-app js/stats.js (eigenes SVG, keine Bibliothek).
const NS = "http://www.w3.org/2000/svg";
const DAYS_SHOWN = 14; // Zeitraum für den Durchschnitt; das Diagramm wächst darüber hinaus mit

function dayKey(iso) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

export function countToday(events) {
  const today = dayKey(new Date().toISOString());
  return events.filter((e) => dayKey(e.ts) === today).length;
}

// Alle Tage (UTC-Datum, wie dayKey) vom ersten Ereignis bis heute, lückenlos.
function daysSince(firstKey) {
  const days = [];
  const end = Date.parse(dayKey(new Date().toISOString()));
  for (let t = Date.parse(firstKey); t <= end; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export function renderStats(container, events) {
  container.innerHTML = "";

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <p class="empty-title">Noch keine Daten</p>
        <p class="empty-sub">Sobald du Karten bearbeitest, erscheint hier dein Verlauf.</p>
      </div>`;
    return;
  }

  const days = daysSince(events.map((e) => dayKey(e.ts)).reduce((m, k) => (k < m ? k : m)));
  const counts = new Map();
  for (const e of events) counts.set(dayKey(e.ts), (counts.get(dayKey(e.ts)) ?? 0) + 1);
  const values = days.map((d) => counts.get(d) ?? 0);
  const avgValues = values.slice(-DAYS_SHOWN);
  const total = events.length;
  const todayCount = values.at(-1);

  const count = document.createElement("p");
  count.className = "stats-count";
  count.textContent = `${total} ${total === 1 ? "Karte" : "Karten"} insgesamt bearbeitet`;
  container.appendChild(count);

  const el = document.createElement("section");
  el.className = "metric";
  el.innerHTML = `
    <div class="metric-head">
      <span class="metric-name">Bearbeitete Karten pro Tag</span>
      <span class="metric-value">${todayCount}<span class="metric-unit">heute</span></span>
    </div>
    <div class="metric-sub">Ø ${avg(avgValues)} pro Tag · ${avgValues.length === 1 ? "heute" : `letzte ${avgValues.length} Tage`}</div>`;
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("chart");
  svg.dataset.values = JSON.stringify(values);
  svg.dataset.labels = JSON.stringify(days.map((d) => d.slice(8, 10)));
  el.appendChild(svg);
  container.appendChild(el);

  drawChart(svg);
}

function drawChart(svg) {
  const values = JSON.parse(svg.dataset.values);
  const labels = JSON.parse(svg.dataset.labels ?? "[]");
  const width = Math.max(svg.clientWidth, 200);
  const height = svg.clientHeight || 104;
  const padL = 2, padR = 28, padT = 8, padB = 16;
  const max = niceMax(Math.max(...values, 1));
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const x = (i) => (values.length === 1 ? padL + plotW / 2 : padL + (i / (values.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / max) * plotH;

  for (const t of [0, max / 2, max]) {
    add(svg, "line", { x1: padL, x2: padL + plotW, y1: y(t), y2: y(t), class: "grid" });
    const label = add(svg, "text", { x: width, y: y(t) + 3.5, "text-anchor": "end", class: "axis" });
    label.textContent = formatTick(t);
  }

  const pts = values.map((v, i) => [x(i), y(v)]);
  if (pts.length > 1) {
    const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    add(svg, "path", { d: `${d}L${pts.at(-1)[0].toFixed(1)},${y(0)}L${pts[0][0].toFixed(1)},${y(0)}Z`, class: "area" });
    add(svg, "path", { d, class: "line" });
  }
  pts.forEach(([px, py], i) => {
    const isLast = i === pts.length - 1;
    add(svg, "circle", { cx: px, cy: py, r: isLast ? 4 : 2.5, class: isLast ? "dot-last" : "dot" });
    if (i % Math.ceil(labels.length / 7 || 1) === 0 || isLast) {
      const label = add(svg, "text", { x: px, y: height - 2, "text-anchor": "middle", class: "axis" });
      label.textContent = labels[i] ?? "";
    }
  });
}

function add(parent, tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.appendChild(el);
  return el;
}

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * pow >= v) return step * pow;
  }
  return 10 * pow;
}

function formatTick(t) {
  return Number.isInteger(t) ? String(t) : t.toFixed(1).replace(".", ",");
}

function avg(values) {
  const a = values.reduce((s, v) => s + v, 0) / values.length;
  return a.toFixed(1).replace(".", ",");
}
