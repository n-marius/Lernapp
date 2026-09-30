#!/usr/bin/env node
// Erzeugt content/index.json aus allen Kartendateien unter content/<gebiet>/.
// Anders als im Referenzprojekt (ukr-app) enthält index.json hier die vollständigen
// Karten (Frage, Antworten, Erklärung), nicht nur Metadaten: Karten sind klein,
// ein zusätzlicher Abruf je Karte zur Laufzeit lohnt sich nicht.
// Ändert sich der Kartenbestand (Prüfsumme), wird "version" automatisch erhöht.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content");
const indexPath = path.join(contentDir, "index.json");
const GEBIETE = ["zivilgericht", "strafrecht", "rechtsanwalt", "verwaltungsrecht"];

const hash = createHash("sha256");
const cards = [];

for (const gebiet of GEBIETE) {
  const dir = path.join(contentDir, gebiet);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const file = `${gebiet}/${name}`;
    const raw = readFileSync(path.join(dir, name), "utf8");
    const card = JSON.parse(raw);
    hash.update(file).update("\0").update(raw).update("\0");
    cards.push({
      id: card.id,
      gebiet: card.gebiet,
      prio: card.prio ?? "normal",
      frage: card.frage,
      ...(card.typ === "begriffe" ? { typ: "begriffe", reihenfolge: !!card.reihenfolge } : {}),
      antworten: card.antworten,
      ...(card.typ === "begriffe" ? { falsche: card.falsche } : {}),
      erklaerung: card.erklaerung ?? "",
      creator: null,
      ...(card.korrigiert ? { korrigiert: card.korrigiert } : {}),
      ts: card.ts,
    });
  }
}
cards.sort((a, b) => a.id.localeCompare(b.id));

const contentHash = hash.digest("hex").slice(0, 16);
const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { version: 0 };
const version = previous.contentHash === contentHash ? previous.version : (previous.version ?? 0) + 1;

const out = `{\n  "version": ${version},\n  "contentHash": "${contentHash}",\n  "cards": ${JSON.stringify(cards, null, 2).replace(/\n/g, "\n  ")}\n}\n`;
writeFileSync(indexPath, out);
console.log(`index.json: ${cards.length} Karte(n), version ${version}${version !== previous.version ? " (erhöht)" : ""}`);
