/**
 * Servidor estático que inyecta GOOGLE_MAPS_API_KEY desde variables de entorno
 * (Railway, Vercel, etc.). En local lee .env si existe.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// En local: cargar .env si existe (Railway usa sus propias variables)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split('\n').forEach(function (line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const i = line.indexOf('=');
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  });
}

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIMES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

function escapeJsString(s) {
  if (s == null) return "''";
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function serveConfig(res) {
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  const body = [
    'const CONFIG = {',
    '  GOOGLE_MAPS_API_KEY: ' + escapeJsString(key) + ',',
    '  DEBOUNCE_MS: 400,',
    '  SEARCH_QUERY_MAX_LENGTH: 100,',
    '  CITY_INPUT_MAX_LENGTH: 80,',
    '  SEARCH_COOLDOWN_MS: 2000,',
    '  DEBUG: false,',
    '  REVIEWS_PER_PLACE_MAX: 5',
    '};',
    'window.CONFIG = CONFIG;'
  ].join('\n');
  res.writeHead(200, { 'Content-Type': 'application/javascript' });
  res.end(body);
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIMES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function serveDescriptionApi(placeId, res) {
  if (!placeId || typeof placeId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ description: null }));
    return;
  }
  placeId = placeId.trim();
  if (placeId.length < 10 || placeId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(placeId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ description: null }));
    return;
  }
  var hasGeminiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) ||
    (process.env.GEMINI_API_KEYS && process.env.GEMINI_API_KEYS.trim());
  if (!hasGeminiKey) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ description: null }));
    return;
  }
  const mod = path.join(ROOT, 'scripts', 'placeDescription.mjs');
  import(mod).then(function (m) {
    return m.getBusinessDescription(placeId, { silent: true });
  }).then(function (out) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ description: out.description || null }));
  }).catch(function (err) {
    console.error('Description API error:', err.message);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ description: null }));
  });
}

const server = http.createServer((req, res) => {
  try {
    const fullUrl = req.url || '';
    const question = fullUrl.indexOf('?');
    const pathname = question === -1 ? fullUrl : fullUrl.slice(0, question);
    const query = question === -1 ? '' : fullUrl.slice(question + 1);
    const url = pathname === '/' ? '/index.html' : pathname;
    const normalized = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.resolve(ROOT, normalized.replace(/^\//, ''));

    if (normalized === '/api/description' || normalized === 'api/description') {
      const params = {};
      query.split('&').forEach(function (pair) {
        const eq = pair.indexOf('=');
        if (eq !== -1) params[decodeURIComponent(pair.slice(0, eq)).trim()] = decodeURIComponent(pair.slice(eq + 1)).trim();
      });
      serveDescriptionApi(params.place_id, res);
      return;
    }

    if (normalized === 'js/config.js' || normalized === '/js/config.js') {
      serveConfig(res);
      return;
    }

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        if (normalized.endsWith('/')) {
          const index = path.join(filePath, 'index.html');
          fs.stat(index, (e, s) => {
            if (e || !s || !s.isFile()) {
              res.writeHead(404);
              res.end();
            } else {
              serveStatic(index, res);
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
        return;
      }
      serveStatic(filePath, res);
    });
  } catch (err) {
    console.error('Error en request:', err);
    res.writeHead(500);
    res.end();
  }
});

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('Servidor en http://' + HOST + ':' + PORT);
});

server.on('error', function (err) {
  console.error('Error del servidor:', err.message);
  process.exit(1);
});

process.on('uncaughtException', function (err) {
  console.error('uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', function (reason, p) {
  console.error('unhandledRejection:', reason);
});

process.on('SIGTERM', function () {
  console.log('SIGTERM, cerrando...');
  server.close(function () {
    process.exit(0);
  });
});

process.on('SIGINT', function () {
  server.close(function () {
    process.exit(0);
  });
});
