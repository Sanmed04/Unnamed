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

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const normalized = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(ROOT, normalized);

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
});

server.listen(PORT, () => {
  console.log('Servidor en http://localhost:' + PORT);
});
