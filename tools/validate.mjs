#!/usr/bin/env node
// Validiert content/index.json und alle referenzierten Kartendateien gegen SPEC.md.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const GEBIETE = ["zivilgericht", "strafrecht", "rechtsanwalt", "verwaltungsrecht"];
const PRIOS = ["hoch", "normal", "niedrig"];

let errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const indexPath = path.join(contentDir, "index.json");
if (!existsSync(indexPath)) {
  console.error("content/index.json fehlt. Zuerst `node tools/build-index.mjs` ausführen.");
  process.exit(1);
}
const index = readJson(indexPath);

if (typeof index.version !== "number") fail("index.json: 'version' fehlt oder ist keine Zahl");

const seenIds = new Set();
for (const card of index.cards ?? []) {
  const ref = `index.json[${card.id ?? "?"}]`;
  if (!card.id) fail(`${ref}: 'id' fehlt`);
  if (!GEBIETE.includes(card.gebiet)) fail(`${ref}: ungültiges gebiet '${card.gebiet}'`);
  if (!PRIOS.includes(card.prio)) fail(`${ref}: ungültige prio '${card.prio}'`);
  if (!card.frage) fail(`${ref}: 'frage' fehlt`);
  if (!Array.isArray(card.antworten) || card.antworten.length !== 4) fail(`${ref}: 'antworten' muss genau 4 Einträge haben`);
  else if (card.antworten.some((a) => !a || typeof a !== "string")) fail(`${ref}: alle 4 Antworten müssen nichtleere Texte sein`);
  if (typeof card.erklaerung !== "string") fail(`${ref}: 'erklaerung' fehlt`);
  if (!card.ts) fail(`${ref}: 'ts' fehlt`);
  if (seenIds.has(card.id)) fail(`${ref}: Duplikat-ID in index.json`);
  seenIds.add(card.id);
}

// Jede Datei unter content/<gebiet>/ muss in index.json auftauchen und umgekehrt.
for (const gebiet of GEBIETE) {
  const dir = path.join(contentDir, gebiet);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const file = readJson(path.join(dir, name));
    const ref = `${gebiet}/${name}`;
    if (!seenIds.has(file.id)) fail(`${ref}: Karte fehlt in index.json (build-index.mjs erneut ausführen)`);
    if (file.gebiet !== gebiet) fail(`${ref}: 'gebiet' im Dateiinhalt ('${file.gebiet}') stimmt nicht mit dem Ordner ('${gebiet}') überein`);
    if (!file.id?.startsWith(`${gebiet}-`)) fail(`${ref}: 'id' sollte mit '${gebiet}-' beginnen`);
  }
}

// Version muss steigen, sobald sich content/ (außer content/_inbox) gegenüber dem letzten Commit geändert hat.
try {
  const git = (cmd) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
  const changed = git("git status --porcelain -- content ':!content/_inbox'").trim() !== "";
  if (changed) {
    const previous = JSON.parse(git("git show HEAD:content/index.json")).version;
    if (!(index.version > previous)) {
      fail(`index.json: Inhalte geändert, aber 'version' nicht erhöht (bisher ${previous}, jetzt ${index.version})`);
    }
  }
} catch {
  // kein Git oder noch kein Commit mit content/index.json: Prüfung entfällt
}

if (errors.length > 0) {
  console.error(`Validierung fehlgeschlagen (${errors.length} Fehler):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Validierung ok: ${index.cards.length} Karte(n) geprüft.`);
