/**
 * CRUD de posibles clientes por usuario (req.user.id).
 */

const { getDb } = require('./db');

function list(req, res) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT place_id, name, address, formatted_phone_number, website, note, custom_message, place_description, status, added_at
    FROM posibles_clientes
    WHERE user_id = ?
    ORDER BY added_at DESC
  `).all(req.user.id);
  const list = rows.map(function (r) {
    return {
      place_id: r.place_id,
      name: r.name,
      address: r.address || '',
      formatted_phone_number: r.formatted_phone_number || '',
      website: r.website || '',
      note: r.note || '',
      custom_message: r.custom_message != null ? r.custom_message : '',
      place_description: r.place_description != null ? r.place_description : '',
      status: r.status != null ? r.status : '',
      addedAt: r.added_at
    };
  });
  res.json(list);
}

function add(req, res) {
  const body = req.body || {};
  const place_id = (body.place_id || '').trim();
  const name = (body.name || '').trim() || 'Sin nombre';
  const address = (body.address || body.vicinity || '').trim();
  const formatted_phone_number = (body.formatted_phone_number || '').trim();
  const website = (body.website || '').trim();
  const custom_message = typeof body.custom_message === 'string' ? body.custom_message.trim() : '';
  const place_description = typeof body.place_description === 'string' ? body.place_description.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  if (!place_id) {
    return res.status(400).json({ error: 'place_id es obligatorio' });
  }
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO posibles_clientes (user_id, place_id, name, address, formatted_phone_number, website, note, custom_message, place_description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, place_id, name, address, formatted_phone_number, website, body.note || '', custom_message, place_description, status);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ya está en tu lista' });
    }
    throw e;
  }
  const row = db.prepare(`
    SELECT place_id, name, address, formatted_phone_number, website, note, custom_message, place_description, status, added_at
    FROM posibles_clientes WHERE user_id = ? AND place_id = ?
  `).get(req.user.id, place_id);
  res.status(201).json({
    place_id: row.place_id,
    name: row.name,
    address: row.address || '',
    formatted_phone_number: row.formatted_phone_number || '',
    website: row.website || '',
    note: row.note || '',
    custom_message: row.custom_message != null ? row.custom_message : '',
    place_description: row.place_description != null ? row.place_description : '',
    status: row.status != null ? row.status : '',
    addedAt: row.added_at
  });
}

function remove(req, res) {
  const placeId = (req.params.placeId || '').trim();
  if (!placeId) {
    return res.status(400).json({ error: 'placeId es obligatorio' });
  }
  const db = getDb();
  const result = db.prepare('DELETE FROM posibles_clientes WHERE user_id = ? AND place_id = ?')
    .run(req.user.id, placeId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  res.status(204).send();
}

function updateNote(req, res) {
  const placeId = (req.params.placeId || '').trim();
  const body = req.body || {};
  const note = typeof body.note === 'string' ? body.note : undefined;
  const custom_message = typeof body.custom_message === 'string' ? body.custom_message : undefined;
  const status = typeof body.status === 'string' ? body.status : undefined;
  if (!placeId) {
    return res.status(400).json({ error: 'placeId es obligatorio' });
  }
  const db = getDb();
  const row = db.prepare('SELECT note, custom_message, status FROM posibles_clientes WHERE user_id = ? AND place_id = ?')
    .get(req.user.id, placeId);
  if (!row) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  const newNote = note !== undefined ? note : row.note;
  const newCustomMessage = custom_message !== undefined ? custom_message : (row.custom_message != null ? row.custom_message : '');
  const newStatus = status !== undefined ? status : (row.status != null ? row.status : '');
  const result = db.prepare('UPDATE posibles_clientes SET note = ?, custom_message = ?, status = ? WHERE user_id = ? AND place_id = ?')
    .run(newNote, newCustomMessage, newStatus, req.user.id, placeId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  res.json({ ok: true });
}

module.exports = {
  list,
  add,
  remove,
  updateNote
};
