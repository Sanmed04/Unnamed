/**
 * placeDescription.mjs
 *
 * Dado un place_id de Google Maps, obtiene todos los datos relevantes
 * y genera una descripción honesta usando Gemini (Flash Lite) — sin inventar nada.
 *
 * Uso:
 *   node scripts/placeDescription.mjs <place_id>
 *
 * Variables de entorno requeridas:
 *   GOOGLE_PLACES_API_KEY  (o GOOGLE_MAPS_API_KEY)
 *   GEMINI_API_KEY
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-2.0-flash-lite"; // alternativas: gemini-2.0-flash, gemini-3-flash-preview

// ─── 1. FETCH PLACE DATA ────────────────────────────────────────────────────

async function fetchPlaceData(placeId) {
  const fields = [
    "name",
    "types",
    "formatted_address",
    "international_phone_number",
    "website",
    "opening_hours",
    "rating",
    "user_ratings_total",
    "price_level",
    "editorial_summary",
    "reviews",
    "photos",
    "wheelchair_accessible_entrance",
    "delivery",
    "dine_in",
    "takeout",
    "reservable",
    "serves_beer",
    "serves_breakfast",
    "serves_brunch",
    "serves_dinner",
    "serves_lunch",
    "serves_vegetarian_food",
    "serves_wine",
    "curbside_pickup",
    "business_status",
  ].join(",");

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}` +
    `&fields=${fields}` +
    `&language=es` +
    `&key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error(`Google Places API error: ${data.status} — ${data.error_message || ""}`);
  }

  return data.result;
}

// ─── 2. EXTRAER SOLO LO QUE EXISTE ──────────────────────────────────────────

const PRICE_MAP = {
  0: "Gratis",
  1: "Económico ($)",
  2: "Precio moderado ($$)",
  3: "Caro ($$$)",
  4: "Muy caro ($$$$)",
};
const BOOLEAN_LABELS = {
  delivery: "Hace delivery",
  dine_in: "Tiene salón para comer en el lugar",
  takeout: "Permite llevar",
  reservable: "Acepta reservas",
  serves_beer: "Sirve cerveza",
  serves_wine: "Sirve vino",
  serves_breakfast: "Sirve desayuno",
  serves_brunch: "Sirve brunch",
  serves_lunch: "Sirve almuerzo",
  serves_dinner: "Sirve cena",
  serves_vegetarian_food: "Tiene opciones vegetarianas",
  curbside_pickup: "Pickup en la vereda",
  wheelchair_accessible_entrance: "Acceso para silla de ruedas",
};

function extractRelevantData(place) {
  const data = {};

  if (place.name) data.nombre = place.name;
  if (place.formatted_address) data.direccion = place.formatted_address;
  if (place.international_phone_number) data.telefono = place.international_phone_number;
  if (place.website) data.sitioWeb = place.website;
  if (place.business_status) data.estado = place.business_status;

  const SKIP_TYPES = new Set(["point_of_interest", "establishment", "food", "store"]);
  if (place.types?.length) {
    data.categorias = place.types
      .filter((t) => !SKIP_TYPES.has(t))
      .map((t) => t.replace(/_/g, " "));
  }

  if (place.rating) {
    data.puntuacion = {
      score: place.rating,
      total: place.user_ratings_total ?? 0,
      resumen: ratingLabel(place.rating),
    };
  }

  if (place.price_level !== undefined) {
    data.nivelDePrecio = PRICE_MAP[place.price_level] ?? null;
  }

  if (place.opening_hours?.weekday_text?.length) {
    data.horarios = place.opening_hours.weekday_text;
    data.abiertoAhora = place.opening_hours.open_now ?? null;
  }

  if (place.editorial_summary?.overview) {
    data.descripcionEditorial = place.editorial_summary.overview;
  }

  const servicios = [];
  for (const [key, label] of Object.entries(BOOLEAN_LABELS)) {
    if (place[key] === true) servicios.push(label);
  }
  if (servicios.length) data.serviciosYAtributos = servicios;

  if (place.reviews?.length) {
    data.reseñasDestacadas = place.reviews
      .slice(0, 3)
      .filter((r) => r.text?.trim().length > 20)
      .map((r) => ({
        puntos: r.rating,
        texto: r.text.trim().slice(0, 300),
        tiempo: r.relative_time_description,
      }));
  }

  return data;
}

function ratingLabel(rating) {
  if (rating >= 4.5) return "Excelente";
  if (rating >= 4.0) return "Muy bueno";
  if (rating >= 3.5) return "Bueno";
  if (rating >= 3.0) return "Regular";
  return "Por debajo del promedio";
}

// ─── 3. GENERAR DESCRIPCIÓN CON GEMINI (Flash Lite) ──────────────────────────

async function generateDescription(extractedData) {
  const dataJson = JSON.stringify(extractedData, null, 2);

  const prompt = `Sos un redactor para una plataforma de negocios locales.

Te doy los datos reales de un negocio obtenidos desde Google Places.
Tu tarea es escribir una descripción clara, útil y honesta para mostrar en la plataforma.

REGLAS ESTRICTAS:
- Usá ÚNICAMENTE la información que está en los datos. No inventes nada.
- Si no hay suficientes datos para algún aspecto, simplemente no lo menciones.
- No uses frases genéricas vacías como "un lugar especial" o "te esperamos".
- El tono es informativo y directo, no marketinero.
- Extensión: entre 60 y 120 palabras.
- Escribí en español rioplatense (Argentina).
- No menciones que la descripción fue generada automáticamente.
- Empezá directamente con la descripción, sin título ni encabezado.

DATOS DEL NEGOCIO:
${dataJson}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 400,
        temperature: 0.4,
      },
    }),
  });

  const result = await res.json();

  if (result.error) {
    throw new Error(`Gemini API error: ${result.error.message}`);
  }

  const textPart = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    throw new Error("Gemini no devolvió texto en la respuesta");
  }

  return textPart.trim();
}

// ─── 4. PIPELINE PRINCIPAL ──────────────────────────────────────────────────

async function getBusinessDescription(placeId) {
  console.log(`\n🔍 Consultando place_id: ${placeId}\n`);

  const raw = await fetchPlaceData(placeId);
  const extracted = extractRelevantData(raw);

  console.log("📦 Datos extraídos:\n");
  console.log(JSON.stringify(extracted, null, 2));

  const hasEnoughData =
    extracted.nombre &&
    (extracted.categorias?.length ||
      extracted.puntuacion ||
      extracted.serviciosYAtributos?.length ||
      extracted.reseñasDestacadas?.length ||
      extracted.descripcionEditorial);

  if (!hasEnoughData) {
    console.warn("\n⚠️  Datos insuficientes para generar una descripción útil.");
    return { extracted, description: null };
  }

  console.log("\n✍️  Generando descripción con Gemini...\n");
  const description = await generateDescription(extracted);

  console.log("─".repeat(60));
  console.log(description);
  console.log("─".repeat(60));

  return { extracted, description };
}

// ─── 5. CLI (solo si se ejecuta este archivo directamente) ───────────────────

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

if (isMain) {
  const placeId = process.argv[2];
  if (!placeId) {
    console.error("Uso: node scripts/placeDescription.mjs <place_id>");
    console.error("Ejemplo: node scripts/placeDescription.mjs ChIJN1t_tDeuEmsRUsoyG83frY4");
    process.exit(1);
  }
  if (!GOOGLE_API_KEY) {
    console.error("Falta GOOGLE_PLACES_API_KEY o GOOGLE_MAPS_API_KEY");
    process.exit(1);
  }
  if (!GEMINI_API_KEY) {
    console.error("Falta GEMINI_API_KEY");
    process.exit(1);
  }
  getBusinessDescription(placeId).catch((err) => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  });
}

export { getBusinessDescription, fetchPlaceData, extractRelevantData, generateDescription };
