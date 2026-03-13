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

function getNextKey() {
  var keys = getGeminiKeys();
  if (!keys.length) return null;
  return keys[Math.floor(Math.random() * keys.length)];
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
    'Quien escribe es un equipo de 2 personas que ofrece hacer páginas web a negocios. El mensaje es para OFRECER ese servicio (por WhatsApp, email, etc.). Siempre hablar en plural: "nos dedicamos", "creemos", "podemos ayudarte", "te contamos", "nos gustaría".\n\n' +
    'Reglas:\n' +
    '- OFRECER página web / presencia online. Decir que una web ayuda a que más clientes los encuentren, conozcan el negocio, etc. Cierre amable (ej. "¿Te gustaría que te contemos cómo podemos ayudarte?").\n' +
    '- Saludo simple: "Buenos días" o "Hola, [Nombre]." NUNCA menciones la dirección, la calle ni la ubicación del negocio en el mensaje (no "Blanco Encalada", "Monroe 4851", ni "¿Cómo andan por [lugar]?").\n' +
    '- Personalizá usando el TIPO o CATEGORÍA del negocio si aparece en la descripción (ej. inmobiliaria, salón de belleza, peluquería, panadería): "Una página web para tu inmobiliaria...", "para tu salón...". Así no suena genérico.\n' +
    '- Tono: humano, cercano, descontracturado. Profesional pero cálido. Breve: 3 a 5 oraciones. Español rioplatense (Argentina).\n' +
    '- No inventes datos que no estén en la descripción. Usá el nombre del negocio solo para saludar si está en la descripción.\n\n' +
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
