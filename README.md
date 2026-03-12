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
│   ├── config.js       # Generado con npm run config
│   └── ...
├── .env.example
└── scripts/inject-env.js
```

## Configuración (no subir datos sensibles)

Variables en **.env** (no subir a GitHub):

- `GOOGLE_MAPS_API_KEY`: clave de Google Maps/Places
- `JWT_SECRET`: clave secreta para los tokens de sesión (backend)
- `PORT`: opcional en local (default 3000); Railway lo define automáticamente

1. Clonar: `git clone ... && cd Unnamed`
2. Copiar: `cp .env.example .env` y completar las variables
3. Generar config del front: `npm run config`
4. Instalar dependencias: `npm install` (o `pnpm install`)
5. Ejecutar: `npm start` → http://localhost:3000 (servidor Express sirve la app y la API)

API key en [Google Cloud Console](https://console.cloud.google.com/): habilitar Maps JavaScript API y Places API.


Se aplican prácticas alineadas con OWASP para reducir riesgos en el cliente:

| Práctica | Implementación |
|----------|----------------|
| **Validación de entrada** | Longitud máxima para búsqueda (100) y ciudad (80), trim, rechazo de vacíos. `js/sanitize.js`: `validateSearchQuery`, `validateCity`. |
| **Output encoding (XSS)** | Todo contenido dinámico que se escribe en HTML pasa por `Sanitize.escapeHtml`. Reseñas con resaltado usan `highlightInText` (escapa y solo envuelve en `<strong>`). |
| **URLs seguras** | Enlaces a Google Maps solo se aceptan si empiezan por `https://` (`sanitizeUrl`). |
| **Content Security Policy** | Meta CSP en `index.html`: solo scripts/style/fonts de orígenes permitidos y Google; sin `unsafe-inline` para scripts. |
| **API key** | Key solo en `.env` (no se sube). `js/config.js` se genera con `npm run config` y está en `.gitignore`. Restringir la key por referrer y por API en Cloud Console. |
| **Cooldown de búsqueda** | `SEARCH_COOLDOWN_MS` en config para limitar frecuencia de llamadas a la API (mitigación básica de abuso). |

El **backend** (Express + SQLite) permite registrar usuarios y guardar la lista de posibles clientes por cuenta; así, al iniciar sesión desde otro dispositivo se ven los mismos datos. En producción servir por **HTTPS**.

### Despliegue en Railway

1. Conectar el repo desde [Railway](https://railway.app/).
2. **Variables de entorno** en el proyecto:
   - `GOOGLE_MAPS_API_KEY`: tu clave de Google Maps/Places.
   - `JWT_SECRET`: una clave larga y aleatoria para las sesiones.
   - Railway define `PORT` automáticamente.
3. **Build**: en Railway, configurar el comando de build como `npm run config` para generar `js/config.js` con la API key (las variables de entorno están disponibles en el build).
4. **Start**: `npm start` (ya en `package.json`).
5. **Persistencia**: la base SQLite usa el disco del servicio (efímero por defecto). Para que no se pierda al redesplegar, añadí un **volume** en Railway y la variable `SQLITE_DB_PATH` apuntando a una ruta en ese volume (ej. `/data/wjf.db`).

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
