/**
 * Genera una descripción breve de un negocio usando Gemini (para vista extendida de posibles clientes).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function generatePlaceDescription(name, address, typeLabel, callback) {
  if (!GEMINI_API_KEY || !GEMINI_API_KEY.trim()) {
    return callback(null, '');
  }
  var typeText = (typeLabel || '').trim() ? ' Tipo: ' + typeLabel + '.' : '';
  var prompt = 'En una sola oración o dos, en español, describí este negocio para un profesional que quiere ofrecerle hacer su página web. Solo datos objetivos: qué es, dónde está, a qué se dedica. Sin opiniones ni ventas.\n\n' +
    'Nombre: ' + (name || 'Sin nombre') + '\n' +
    'Dirección: ' + (address || '') + typeText;

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY.trim());
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.3
      }
    })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var text = '';
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        text = (data.candidates[0].content.parts[0].text || '').trim();
      }
      callback(null, text);
    })
    .catch(function (err) {
      callback(err, '');
    });
}

module.exports = { generatePlaceDescription };
