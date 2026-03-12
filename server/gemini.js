/**
 * Gemini: descripción del negocio (desde datos) y mensaje para el cliente (desde la descripción).
 * Variables: GEMINI_API_KEYS (varias separadas por coma) o GEMINI_API_KEY, GEMINI_MODEL (ej. gemini-2.5-flash-lite).
 */

function getGeminiKeys() {
  var fromList = process.env.GEMINI_API_KEYS;
  if (fromList && typeof fromList === 'string' && fromList.trim()) {
    return fromList.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
  }
  var single = process.env.GEMINI_API_KEY;
  return single && single.trim() ? [single.trim()] : [];
}

var _geminiKeyIndex = 0;
function getNextKey() {
  var keys = getGeminiKeys();
  if (!keys.length) return null;
  return keys[_geminiKeyIndex++ % keys.length];
}

var GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim();

function hasGeminiKey() {
  return getGeminiKeys().length > 0;
}

function generatePlaceDescription(name, address, typeLabel, callback) {
  var key = getNextKey();
  if (!key) return callback(null, '');

  var typeText = (typeLabel || '').trim() ? ' Tipo: ' + typeLabel + '.' : '';
  var prompt = 'En una sola oración o dos, en español, describí este negocio para un profesional que quiere ofrecerle hacer su página web. Solo datos objetivos: qué es, dónde está, a qué se dedica. Sin opiniones ni ventas.\n\n' +
    'Nombre: ' + (name || 'Sin nombre') + '\n' +
    'Dirección: ' + (address || '') + typeText;

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.3 }
    })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        text = (data.candidates[0].content.parts[0].text || '').trim();
      }
      if (data.error) return callback(new Error(data.error.message || 'Gemini error'), '');
      callback(null, text);
    })
    .catch(function (err) { return callback(err, ''); });
}

/**
 * Genera el mensaje para el cliente a partir de la descripción del negocio (generada antes con Gemini).
 */
function generateCustomMessage(description, businessName, callback) {
  if (!description || typeof description !== 'string' || !description.trim()) {
    return callback(new Error('Falta la descripción del negocio'), '');
  }
  var key = getNextKey();
  if (!key) return callback(new Error('Falta GEMINI_API_KEY o GEMINI_API_KEYS'), '');

  var name = (businessName && String(businessName).trim()) ? businessName.trim() : 'el negocio';
  var prompt = 'Sos un asistente que escribe mensajes cortos para contactar negocios.\n\n' +
    'Te doy la descripción de un negocio. Generá un MENSAJE ÚNICO que alguien podría usar para escribirles (por WhatsApp, email, etc.). El mensaje debe:\n' +
    '- Mencionar 1 o 2 aspectos concretos del negocio sacados de la descripción (tipo de lugar, especialidad, algo que los destaque).\n' +
    '- Ser editable: tono profesional pero cercano, que el usuario pueda personalizarlo después.\n' +
    '- Ser breve: entre 3 y 5 oraciones.\n' +
    '- Estar en español rioplatense (Argentina).\n' +
    '- No incluir saludo genérico tipo "Hola, les escribo..."; empezá directo con el contenido útil.\n' +
    '- No inventes datos que no estén en la descripción.\n\n' +
    'Nombre del negocio (para referencia): ' + name + '\n\n' +
    'DESCRIPCIÓN DEL NEGOCIO:\n' + description.trim().slice(0, 2000) + '\n\n' +
    'Respondé solo con el texto del mensaje, sin título ni explicaciones.';

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 350, temperature: 0.5 }
    })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.error) return callback(new Error(data.error.message || 'Gemini error'), '');
      var text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        text = (data.candidates[0].content.parts[0].text || '').trim();
      }
      callback(null, text);
    })
    .catch(function (err) { return callback(err, ''); });
}

module.exports = { hasGeminiKey, generatePlaceDescription, generateCustomMessage };
