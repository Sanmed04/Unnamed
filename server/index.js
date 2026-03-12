/**
 * Servidor Web Job Finder: API (auth + posibles clientes) y archivos estáticos.
 * Para Railway: PORT en env. SQLite en data/wjf.db (persistir con volumen si hace falta).
 */

const express = require('express');
const path = require('path');
const { register, login, requireAuth } = require('./auth');
const posiblesClientes = require('./posiblesClientes');
const { generatePlaceDescription } = require('./gemini');

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
    if (err) return res.status(500).json({ error: 'No se pudo generar la descripción' });
    res.json({ description: description || '' });
  });
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
