/**
 * Registro, login y middleware JWT.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'wjf-dev-secret-change-in-production';
const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * Middleware: requiere Authorization: Bearer <token>. Pone req.user = { id, email }.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  req.user = { id: payload.userId, email: payload.email };
  next();
}

function register(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
  }
  const hash = hashPassword(password);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const token = createToken(result.lastInsertRowid, email);
  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, email }
  });
}

function login(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }
  const db = getDb();
  const row = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (!row || !comparePassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  const token = createToken(row.id, email);
  res.json({
    token,
    user: { id: row.id, email }
  });
}

module.exports = {
  requireAuth,
  register,
  login,
  createToken,
  verifyToken
};
