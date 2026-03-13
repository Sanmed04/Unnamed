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

function isQuotaError(err) {
  if (!err || !err.message) return false;
  var m = String(err.message).toLowerCase();
  return m.indexOf('quota') !== -1 || m.indexOf('exceeded') !== -1 || m.indexOf('rate') !== -1;
}

function isKeyError(err) {
  if (!err || !err.message) return false;
  var m = String(err.message).toLowerCase();
  return m.indexOf('expired') !== -1 || m.indexOf('invalid') !== -1 || m.indexOf('api key') !== -1;
}

function shouldTryNextKey(err, keyIndex, keysLength) {
  return keyIndex + 1 < keysLength && (isQuotaError(err) || isKeyError(err));
}

var GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim();

function hasGeminiKey() {
  return getGeminiKeys().length > 0;
}

function generatePlaceDescription(name, address, typeLabel, callback) {
  var keys = getGeminiKeys();
  if (!keys.length) return callback(new Error('Falta GEMINI_API_KEY o GEMINI_API_KEYS'), '');

  var typeText = (typeLabel || '').trim() ? '. Tipo: ' + typeLabel : '';
  var prompt = 'Una oración en español: qué es este negocio y a qué se dedica. Solo datos.\n' + (name || 'Sin nombre') + '. ' + (address || '') + typeText;

  function tryKey(keyIndex) {
    if (keyIndex >= keys.length) return callback(new Error('Todas las API keys de Gemini fallaron (cuota o key vencida). Revisá GEMINI_API_KEYS y reintentá.'), '');
    var key = keys[keyIndex];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.3 }
      })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
            return { error: { message: msg } };
          }
          return data;
        }).catch(function () {
          return { error: { message: 'HTTP ' + res.status + ' – respuesta no JSON' } };
        });
      })
      .then(function (data) {
        var text = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          text = (data.candidates[0].content.parts[0].text || '').trim();
        }
        if (data.error) {
          var err = new Error(data.error.message || 'Gemini error');
          if (shouldTryNextKey(err, keyIndex, keys.length)) return tryKey(keyIndex + 1);
          return callback(err, '');
        }
        callback(null, text);
      })
      .catch(function (err) {
        if (shouldTryNextKey(err, keyIndex, keys.length)) return tryKey(keyIndex + 1);
        return callback(err, '');
      });
  }
  tryKey(0);
}

/**
 * Genera el mensaje para el cliente a partir de la descripción del negocio (generada antes con Gemini).
 */
function generateCustomMessage(description, businessName, callback) {
  if (!description || typeof description !== 'string' || !description.trim()) {
    return callback(new Error('Falta la descripción del negocio'), '');
  }
  var keys = getGeminiKeys();
  if (!keys.length) return callback(new Error('Falta GEMINI_API_KEY o GEMINI_API_KEYS'), '');

  var name = (businessName && String(businessName).trim()) ? businessName.trim() : 'el negocio';
  var desc = description.trim().slice(0, 1200);
  var prompt = 'Mensaje de venta corto (3-5 oraciones) para ofrecer página web a un negocio. Equipo de 2, plural ("nos dedicamos", "podemos ayudarte"). Saludo: "Buenos días" o "Hola, [Nombre]". No menciones dirección ni ubicación. Personalizá por tipo (ej. "para tu peluquería"). Tono cercano, español Argentina. Solo el mensaje, sin título.\n\nNegocio: ' + name + '\n' + desc;

  function tryKey(keyIndex) {
    if (keyIndex >= keys.length) return callback(new Error('Todas las API keys de Gemini fallaron (cuota o key vencida). Revisá GEMINI_API_KEYS y reintentá.'), '');
    var key = keys[keyIndex];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 220, temperature: 0.5 }
      })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
            return { error: { message: msg } };
          }
          return data;
        }).catch(function () {
          return { error: { message: 'HTTP ' + res.status + ' – respuesta no JSON' } };
        });
      })
      .then(function (data) {
        if (data.error) {
          var err = new Error(data.error.message || 'Gemini error');
          if (shouldTryNextKey(err, keyIndex, keys.length)) return tryKey(keyIndex + 1);
          return callback(err, '');
        }
        var text = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          text = (data.candidates[0].content.parts[0].text || '').trim();
        }
        callback(null, text);
      })
      .catch(function (err) {
        if (shouldTryNextKey(err, keyIndex, keys.length)) return tryKey(keyIndex + 1);
        return callback(err, '');
      });
  }
  tryKey(0);
}

module.exports = { hasGeminiKey, generatePlaceDescription, generateCustomMessage };
