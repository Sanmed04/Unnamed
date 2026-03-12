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
  var prompt = 'Sos un asistente que escribe mensajes de VENTA para contactar negocios.\n\n' +
    'Quien escribe es una persona FREELANCE que ofrece hacer páginas web a negocios. El mensaje es para OFRECER ese servicio al negocio (por WhatsApp, email, etc.), no para preguntarles por sus productos.\n\n' +
    'Reglas:\n' +
    '- El mensaje debe OFRECER una página web / presencia online al negocio. Decir que ayudás a que más clientes los encuentren, conozcan el negocio, etc. Incluir una pregunta o cierre amable (ej. si quieren que les cuentes cómo podés ayudarlos).\n' +
    '- Mencionar algo concreto del negocio sacado de la descripción (nombre, tipo, ubicación) para que suene personal, no genérico.\n' +
    '- Tono: humano, cercano y descontracturado. Como un freelance que escribe a un dueño de negocio, no como una empresa corporativa. Profesional pero cálido, sin frases rígidas ni de manual de ventas.\n' +
    '- Breve: 3 a 5 oraciones. Español rioplatense (Argentina).\n' +
    '- No inventes datos que no estén en la descripción. Podés usar el nombre del negocio para saludar (ej. "Hola, [Nombre].") si está en la descripción.\n\n' +
    'Nombre del negocio: ' + name + '\n\n' +
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
