# Web Job Finder

Aplicación web de una sola página para encontrar negocios cerca, filtrar por tipo y armar una lista de posibles clientes. Usa la API de Google Places y geolocalización.

## Estructura del proyecto

```
├── index.html
├── .env.example        # Copiar a .env (no subir .env a GitHub)
├── .gitignore
├── css/main.css
├── js/
│   ├── config.template.js   # js/config.js se genera con npm run config
│   ├── sanitize.js
│   ├── api.js
│   ├── search.js
│   ├── ui.js
│   └── app.js
├── server.js            # Sirve estáticos e inyecta GOOGLE_MAPS_API_KEY en /js/config.js
└── scripts/
    ├── inject-env.js
    ├── placeDescription.mjs   # Descripción de un negocio con Gemini Flash Lite
    └── batchDescriptions.mjs  # Lote de place_ids → results.json
```

## Configuración (no subir datos sensibles)

**Railway / producción:** En el proyecto de Railway → **Variables**, agregá:
- `GOOGLE_MAPS_API_KEY` = tu clave de Google
- `PORT` = **3000** (si en Public Networking el dominio apunta a “Port 3000”; tiene que coincidir con el puerto que muestra ahí)

El servidor usa `process.env.PORT`; si Railway no inyecta PORT o usa otro valor, el proxy no puede conectar y la app “falla” sin error en logs. Que **PORT** coincida con el puerto del dominio.

**Local:** Poné la key en `.env` como `GOOGLE_MAPS_API_KEY=...` y ejecutá `npm run dev`. El servidor lee `.env` si existe.

1. Clonar: `git clone https://github.com/Sanmed04/Unnamed.git && cd Unnamed`
2. **Local:** `cp .env.example .env` y editar con tu key. **Railway:** agregar variable `GOOGLE_MAPS_API_KEY` en el proyecto.
3. Ejecutar: `npm run dev` (local) o `npm start` (Railway usa `start` por defecto) → http://localhost:3000 o tu URL de Railway.

API key en [Google Cloud Console](https://console.cloud.google.com/) (Clave de API, no OAuth), habilitar Maps JavaScript API y Places API. En restricciones, agregar el dominio de Railway (ej. `https://tu-app.up.railway.app/*`).


Se aplican prácticas alineadas con OWASP para reducir riesgos en el cliente:

| Práctica | Implementación |
|----------|----------------|
| **Validación de entrada** | Longitud máxima para búsqueda (100) y ciudad (80), trim, rechazo de vacíos. `js/sanitize.js`: `validateSearchQuery`, `validateCity`. |
| **Output encoding (XSS)** | Todo contenido dinámico que se escribe en HTML pasa por `Sanitize.escapeHtml`. Reseñas con resaltado usan `highlightInText` (escapa y solo envuelve en `<strong>`). |
| **URLs seguras** | Enlaces a Google Maps solo se aceptan si empiezan por `https://` (`sanitizeUrl`). |
| **Content Security Policy** | Meta CSP en `index.html`: solo scripts/style/fonts de orígenes permitidos y Google; sin `unsafe-inline` para scripts. |
| **API key** | Key solo en `.env` (no se sube). `js/config.js` se genera con `npm run config` y está en `.gitignore`. Restringir la key por referrer y por API en Cloud Console. |
| **Cooldown de búsqueda** | `SEARCH_COOLDOWN_MS` en config para limitar frecuencia de llamadas a la API (mitigación básica de abuso). |

No hay backend: todas las llamadas son desde el navegador a la API de Google. En producción se recomienda servir la app por **HTTPS**.

## Descripciones de negocios con Gemini (opcional)

La app y los scripts obtienen datos de Google Place Details y generan una descripción corta con **Gemini** (solo datos reales, sin inventar). La descripción se muestra en el panel de detalle al abrir un negocio.

- **Variables de entorno:** `GEMINI_API_KEY` (o varias en `GEMINI_API_KEYS=key1,key2,key3` para rotar y repartir cuota). Opcional: `GEMINI_MODEL` (por defecto `gemini-2.5-flash-lite`). Para Places: `GOOGLE_PLACES_API_KEY` o `GOOGLE_MAPS_API_KEY`.
- **Un solo lugar:**  
  `node scripts/placeDescription.mjs <place_id>`
- **Varios lugares:** Crear un JSON con array de `place_id` y ejecutar:  
  `node scripts/batchDescriptions.mjs places.json` → resultados en `results.json`.

Gemini API key en [Google AI Studio](https://aistudio.google.com/apikey). Si un modelo agota cuota, probar otro en `GEMINI_MODEL` (ej. `gemini-2.5-flash-lite-preview-09-2025`, `gemini-3-flash-preview`).

## Tecnologías

- HTML5, CSS3, JavaScript (vanilla).
- Google Places (Text Search + Place Details + Reviews).
- Geolocation API del navegador.

## Subir a GitHub

No se suben **.env** ni **js/config.js** (están en `.gitignore`). Solo se sube la plantilla `.env.example` y `js/config.template.js`.

```bash
git init
git add .
git commit -m "Initial commit: Web Job Finder"
git remote add origin https://github.com/Sanmed04/Unnamed.git
git branch -M main
git push -u origin main
```

Quien clone el repo debe crear `.env` desde `.env.example`, poner su API key y ejecutar `npm run config`.

## Licencia

Uso libre para fines educativos o personales. Uso de Google Places sujeto a los términos de Google.
