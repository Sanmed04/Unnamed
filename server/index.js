/**
 * Servidor Web Job Finder: API (auth + posibles clientes) y archivos estáticos.
 * Para Railway: PORT y API keys en variables de entorno. En local se usa .env.
 */

const fs = require('fs');
const express = require('express');
const path = require('path');
const { register, login, requireAuth } = require('./auth');
const posiblesClientes = require('./posiblesClientes');
const { generatePlaceDescription, generateCustomMessage } = require('./gemini');

// Cargar .env en local (Railway usa sus propias variables de entorno)
const envPath = path.join(__dirname, '..', '.env');
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS: en producción mismo origen; permitir origen del front si está en otro dominio
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

// --- API ---

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

app.get('/api/posibles-clientes', requireAuth, posiblesClientes.list);
app.post('/api/posibles-clientes', requireAuth, posiblesClientes.add);
app.delete('/api/posibles-clientes/:placeId', requireAuth, posiblesClientes.remove);
app.patch('/api/posibles-clientes/:placeId', requireAuth, posiblesClientes.updateNote);

app.post('/api/generate-place-description', requireAuth, function (req, res) {
  var name = (req.body.name || '').trim() || 'Sin nombre';
  var address = (req.body.address || req.body.vicinity || '').trim();
  var type = (req.body.type || '').trim();
  generatePlaceDescription(name, address, type, function (err, description) {
    if (err) {
      console.error('generate-place-description error:', err.message || err);
      var msg = 'No se pudo generar la descripción';
      if (err.message && err.message.indexOf('Falta GEMINI') !== -1) msg = 'Falta configurar la API de Gemini en el servidor (GEMINI_API_KEY).';
      return res.status(500).json({ error: msg });
    }
    res.json({ description: description || '' });
  });
});

app.post('/api/generate-custom-message', requireAuth, function (req, res) {
  var description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  var businessName = typeof req.body.businessName === 'string' ? req.body.businessName.trim() : '';
  if (!description) return res.status(400).json({ error: 'Falta la descripción' });
  generateCustomMessage(description, businessName, function (err, message) {
    if (err) {
      console.error('generate-custom-message error:', err.message || err);
      var msg = 'No se pudo generar el mensaje';
      if (err.message && err.message.indexOf('Falta GEMINI') !== -1) msg = 'Falta configurar la API de Gemini en el servidor (GEMINI_API_KEY).';
      return res.status(500).json({ error: msg });
    }
    res.json({ message: message || '' });
  });
});

// Config desde variables de entorno (.env en local, Railway en producción). No usar archivo config.
function escapeJsString(s) {
  if (s == null) return "''";
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
app.get('/js/config.js', function (req, res) {
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
  res.type('application/javascript');
  res.send(body);
});

// --- Estáticos (index, css, js) ---
const staticDir = path.join(__dirname, '..');
app.use(express.static(staticDir, { index: 'index.html' }));

app.get('*', function (req, res) {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, function () {
  console.log('Web Job Finder server on port', PORT);
});
