/**
 * batchDescriptions.mjs
 *
 * Procesa múltiples negocios en paralelo (con rate limiting).
 * Usa Gemini Flash Lite vía placeDescription.mjs.
 *
 * Uso:
 *   node scripts/batchDescriptions.mjs places.json
 *
 * El archivo JSON debe ser un array de place_ids:
 *   ["ChIJ...", "ChIJ...", ...]
 *
 * O un array de objetos con más contexto:
 *   [{ "place_id": "ChIJ...", "id": "mi-id-interno" }, ...]
 *
 * Variables de entorno: GOOGLE_PLACES_API_KEY (o GOOGLE_MAPS_API_KEY), GEMINI_API_KEY
 */

import { getBusinessDescription } from "./placeDescription.mjs";
import { readFileSync, writeFileSync } from "fs";

const CONCURRENCY = 3;   // requests simultáneos (evita ban de Google)
const DELAY_MS    = 500; // pausa entre batches

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processBatch() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error("Uso: node scripts/batchDescriptions.mjs <archivo.json>");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf-8"));
  const list = raw.map((item) =>
    typeof item === "string" ? { place_id: item } : item
  );

  console.log(`\n📋 Procesando ${list.length} negocios...\n`);

  const results = [];

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const res = await getBusinessDescription(item.place_id);
        return { ...item, ...res };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        console.error("❌ Error en item:", r.reason?.message);
        results.push({ error: r.reason?.message });
      }
    }

    if (i + CONCURRENCY < list.length) {
      await sleep(DELAY_MS);
    }
  }

  const outFile = "results.json";
  writeFileSync(outFile, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✅ Resultados guardados en ${outFile}`);

  const ok = results.filter((r) => r.description).length;
  const noData = results.filter((r) => r.description === null).length;
  const errors = results.filter((r) => r.error).length;
  console.log(`\n📊 Resumen: ${ok} con descripción | ${noData} sin datos suficientes | ${errors} errores`);
}

processBatch().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
