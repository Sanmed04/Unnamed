# ¿Dónde Está?

Aplicación web de una sola página para encontrar comida y bebida cerca en tiempo real usando la API de Google Places y geolocalización.

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
└── scripts/inject-env.js
```

## Configuración (no subir datos sensibles)

La API key va en **.env** (local). No subas `.env` ni `js/config.js` a GitHub.

1. Clonar: `git clone https://github.com/Sanmed04/Unnamed.git && cd Unnamed`
2. Copiar: `cp .env.example .env` y editar `.env` con tu `GOOGLE_MAPS_API_KEY=...`
3. Generar config: `npm run config`
4. Ejecutar: `npm run dev` → http://localhost:3000

API key en [Google Cloud Console](https://console.cloud.google.com/) (Clave de API, no OAuth), habilitar Maps JavaScript API y Places API.


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

## Tecnologías

- HTML5, CSS3, JavaScript (vanilla).
- Google Places (Text Search + Place Details + Reviews).
- Geolocation API del navegador.

## Subir a GitHub

No se suben **.env** ni **js/config.js** (están en `.gitignore`). Solo se sube la plantilla `.env.example` y `js/config.template.js`.

```bash
git init
git add .
git commit -m "Initial commit: ¿Dónde Está?"
git remote add origin https://github.com/Sanmed04/Unnamed.git
git branch -M main
git push -u origin main
```

Quien clone el repo debe crear `.env` desde `.env.example`, poner su API key y ejecutar `npm run config`.

## Licencia

Uso libre para fines educativos o personales. Uso de Google Places sujeto a los términos de Google.
