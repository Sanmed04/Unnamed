/**
 * Sanitización y validación según OWASP (XSS, validación de entrada).
 * - Validación: longitud, trim, rechazo de vacíos.
 * - Output encoding: escapeHtml para todo contenido dinámico en HTML.
 * - URLs: solo permitir https para enlaces externos.
 */

(function (global) {
  'use strict';

  const MAX_QUERY_LENGTH = (global.CONFIG && global.CONFIG.SEARCH_QUERY_MAX_LENGTH) || 100;
  const MAX_CITY_LENGTH = (global.CONFIG && global.CONFIG.CITY_INPUT_MAX_LENGTH) || 80;

  /**
   * Escapa HTML para prevenir XSS (OWASP: output encoding).
   * Usar para cualquier string que se inserte en innerHTML / document.write.
   * @param {string} s - Texto a escapar
   * @returns {string}
   */
  function escapeHtml(s) {
    if (s == null || typeof s !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /**
   * Valida y normaliza el término de búsqueda.
   * - Trim, longitud máxima, rechazo de vacío.
   * @param {string} raw - Valor crudo del input
   * @returns {{ valid: boolean, value: string, error?: string }}
   */
  function validateSearchQuery(raw) {
    const value = (typeof raw === 'string' ? raw : '').trim();
    if (value.length === 0) {
      return { valid: false, value: '', error: 'Ingresá un término de búsqueda.' };
    }
    if (value.length > MAX_QUERY_LENGTH) {
      return {
        valid: false,
        value: value.slice(0, MAX_QUERY_LENGTH),
        error: 'El término es demasiado largo.'
      };
    }
    return { valid: true, value: value };
  }

  /**
   * Valida y normaliza el nombre de ciudad (fallback de ubicación).
   * @param {string} raw - Valor crudo del input
   * @returns {{ valid: boolean, value: string, error?: string }}
   */
  function validateCity(raw) {
    const value = (typeof raw === 'string' ? raw : '').trim();
    if (value.length === 0) {
      return { valid: false, value: '', error: 'Ingresá una ciudad.' };
    }
    if (value.length > MAX_CITY_LENGTH) {
      return {
        valid: false,
        value: value.slice(0, MAX_CITY_LENGTH),
        error: 'El nombre de la ciudad es demasiado largo.'
      };
    }
    return { valid: true, value: value };
  }

  /**
   * Comprueba que una URL sea segura para href (solo https).
   * Evita javascript: y otros esquemas (OWASP: validación de URL).
   * @param {string} url
   * @returns {string} URL segura o '#' si no es válida
   */
  function sanitizeUrl(url) {
    if (url == null || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (trimmed.toLowerCase().indexOf('https://') === 0) return trimmed;
    return '#';
  }

  /**
   * Escapa texto y resalta una subcadena (para reseñas).
   * La subcadena se envuelve en <strong>; todo el contenido se escapa para evitar XSS.
   */
  function highlightInText(text, highlightSubstring) {
    if (!text || typeof text !== 'string') return '';
    if (!highlightSubstring || typeof highlightSubstring !== 'string') return escapeHtml(text);
    const lower = text.toLowerCase();
    const subLower = highlightSubstring.toLowerCase();
    const idx = lower.indexOf(subLower);
    if (idx === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      '<strong>' + escapeHtml(text.slice(idx, idx + highlightSubstring.length)) + '</strong>' +
      escapeHtml(text.slice(idx + highlightSubstring.length))
    );
  }

  /**
   * Escapa caracteres especiales para usar en RegExp.
   */
  function escapeRegex(s) {
    if (s == null || typeof s !== 'string') return '';
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Mapa vocal sin acento -> clase de caracter que matchea con o sin acento */
  var accentRegexMap = { a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]', c: '[cç]' };

  function toAccentInsensitivePattern(word) {
    var lower = word.toLowerCase();
    var out = '';
    for (var j = 0; j < lower.length; j++) {
      out += accentRegexMap[lower[j]] || escapeRegex(lower[j]);
    }
    return out;
  }

  /**
   * Escapa el texto y resalta cada palabra del array (en cualquier orden).
   * Las palabras se matchean sin importar acentos (cafe resalta café).
   * @param {string} text - Texto completo
   * @param {string[]} words - Palabras a resaltar (case-insensitive)
   * @returns {string} HTML seguro
   */
  function highlightWordsInText(text, words) {
    if (!text || typeof text !== 'string') return '';
    var result = escapeHtml(text);
    if (!words || !words.length) return result;
    for (var i = 0; i < words.length; i++) {
      var w = (words[i] || '').trim();
      if (!w) continue;
      var pattern = toAccentInsensitivePattern(w);
      if (!pattern) continue;
      try {
        var regex = new RegExp(pattern, 'gi');
        result = result.replace(regex, '<strong>$&</strong>');
      } catch (e) {
        /* ignore invalid regex */
      }
    }
    return result;
  }

  /**
   * Devuelve las palabras de la búsqueda (trim, split por espacios, sin vacías).
   * @param {string} query
   * @returns {string[]}
   */
  function getQueryWords(query) {
    if (query == null || typeof query !== 'string') return [];
    return query.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
  }

  /**
   * Normaliza acentos para comparación (café ↔ cafe, etc.).
   * @param {string} s
   * @returns {string}
   */
  function normalizeAccents(s) {
    if (s == null || typeof s !== 'string') return '';
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  global.Sanitize = {
    escapeHtml,
    validateSearchQuery,
    validateCity,
    sanitizeUrl,
    highlightInText,
    highlightWordsInText,
    getQueryWords,
    normalizeAccents
  };
})(typeof window !== 'undefined' ? window : this);
