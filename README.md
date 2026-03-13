# Web Job Finder

Aplicación web de una sola página para encontrar negocios cerca, filtrar por tipo y armar una lista de posibles clientes. Usa la API de Google Places y geolocalización.

## Estructura del proyecto

```
├── index.html
├── server/              # Backend Express + SQLite
│   ├── index.js        # Servidor (API + estáticos)
│   ├── db.js           # SQLite (users, posibles_clientes)
│   ├── auth.js         # Registro, login, JWT
│   └── posiblesClientes.js
├── js/
│   ├── auth-api.js     # Cliente API auth y posibles clientes
│   └── ...
└── .env.example
```

## Configuración (no subir datos sensibles)

Variables en **.env** (no subir a GitHub):

- `GOOGLE_MAPS_API_KEY`: clave de Google Maps/Places
- `JWT_SECRET`: clave secreta para los tokens de sesión (backend)
- `PORT`: opcional en local (default 3000); Railway lo define automáticamente

1. Clonar: `git clone ... && cd Unnamed`
2. Copiar: `cp .env.example .env` y completar las variables (en Railway se configuran en el dashboard, no en archivos).
3. Instalar dependencias: `npm install` (o `pnpm install`)
4. Ejecutar: `npm start` → http://localhost:3000 (el servidor lee .env en local y sirve la config desde variables de entorno)

API key en [Google Cloud Console](https://console.cloud.google.com/): habilitar Maps JavaScript API y Places API.

Se aplican prácticas alineadas con OWASP para reducir riesgos en el cliente:

| Práctica | Implementación |
|----------|----------------|
| **Validación de entrada** | Longitud máxima para búsqueda (100) y ciudad (80), trim, rechazo de vacíos. `js/sanitize.js`: `validateSearchQuery`, `validateCity`. |
| **Output encoding (XSS)** | Todo contenido dinámico que se escribe en HTML pasa por `Sanitize.escapeHtml`. Reseñas con resaltado usan `highlightInText` (escapa y solo envuelve en `<strong>`). |
| **URLs seguras** | Enlaces a Google Maps solo se aceptan si empiezan por `https://` (`sanitizeUrl`). |
| **Content Security Policy** | Meta CSP en `index.html`: solo scripts/style/fonts de orígenes permitidos y Google; sin `unsafe-inline` para scripts. |
| **API key** | Key solo en `.env` en local (no se sube). En producción (Railway) se usan las variables de entorno del proyecto. El servidor sirve `/js/config.js` inyectando la key desde env. Restringir la key por referrer y por API en Cloud Console. |
| **Cooldown de búsqueda** | `SEARCH_COOLDOWN_MS` en config para limitar frecuencia de llamadas a la API (mitigación básica de abuso). |

El **backend** (Express + SQLite) permite registrar usuarios y guardar la lista de posibles clientes por cuenta; así, al iniciar sesión desde otro dispositivo se ven los mismos datos. En producción servir por **HTTPS**.

### Despliegue en Railway

1. Conectar el repo desde [Railway](https://railway.app/).
2. **Variables de entorno** en el proyecto:
   - `GOOGLE_MAPS_API_KEY`: tu clave de Google Maps/Places.
   - `JWT_SECRET`: una clave larga y aleatoria para las sesiones.
   - Railway define `PORT` automáticamente.
3. **Build**: no hace falta comando de build especial; las API keys se leen en runtime desde las variables de entorno.
4. **Start**: `npm start` (o `pnpm run start`).
5. **Persistencia (evitar perder usuarios y datos en redeploys)**  
   La base SQLite por defecto está en el disco efímero del servicio; en cada redeploy puede borrarse. Para que persista:
   - En tu proyecto de Railway → **tu servicio** (el backend).
   - Pestaña **Variables** → **Add Variable** → Nueva variable: `SQLITE_DB_PATH` = `/data/wjf.db`.
   - Pestaña **Settings** (o **Volumes**) → **Add Volume** (o **Mount**).  
     - **Mount path**: `/data` (tiene que coincidir con la carpeta del path anterior).
     - Guardar.
   - Hacé un **redeploy** para que el servicio arranque con el volumen montado.  
   A partir de ahí la base se guarda en el volumen y sobrevive a los redeploys. Si ya tenías usuarios, registralos de nuevo la primera vez después de añadir el volumen (la base empieza vacía en el volumen).

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

No se sube **.env** (está en `.gitignore`). Se sube la plantilla `.env.example`.

```bash
git init
git add .
git commit -m "Initial commit: Web Job Finder"
git remote add origin https://github.com/Sanmed04/Unnamed.git
git branch -M main
git push -u origin main
```

Quien clone el repo debe crear `.env` desde `.env.example` y completar las variables; en Railway se configuran en el dashboard.

## Licencia

Uso libre para fines educativos o personales. Uso de Google Places sujeto a los términos de Google.
