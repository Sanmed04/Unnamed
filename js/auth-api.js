/**
 * API de autenticación y posibles clientes en el servidor.
 * Si no hay token, las funciones de lista/add/remove/update no llaman al servidor.
 */

(function (global) {
  'use strict';

  var TOKEN_KEY = 'wjf_token';
  var USER_KEY = 'wjf_user';

  function getBaseUrl() {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setToken(token, user) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {}
  }

  function getStoredUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function request(method, path, body, callback) {
    var url = getBaseUrl() + path;
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    var token = getToken();
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      opts.body = JSON.stringify(body);
    }
    fetch(url, opts)
      .then(function (res) {
        var contentType = res.headers.get('Content-Type') || '';
        var isJson = contentType.indexOf('application/json') !== -1;
        if (!res.ok) {
          return (isJson ? res.json() : res.text()).then(function (data) {
            var err = new Error(data.error || data || 'Error');
            err.status = res.status;
            err.data = data;
            throw err;
          });
        }
        if (res.status === 204) return callback(null, null);
        return isJson ? res.json() : res.text();
      })
      .then(function (data) { callback(null, data); })
      .catch(function (err) { callback(err, null); });
  }

  function register(email, password, callback) {
    request('POST', '/api/auth/register', { email: email, password: password }, function (err, data) {
      if (err) return callback(err);
      setToken(data.token, data.user);
      callback(null, data.user);
    });
  }

  function login(email, password, callback) {
    request('POST', '/api/auth/login', { email: email, password: password }, function (err, data) {
      if (err) return callback(err);
      setToken(data.token, data.user);
      callback(null, data.user);
    });
  }

  function logout() {
    setToken(null);
  }

  function getPosiblesClientesFromServer(callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), null);
    request('GET', '/api/posibles-clientes', null, callback);
  }

  function addPosibleClienteToServer(item, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), null);
    request('POST', '/api/posibles-clientes', {
      place_id: item.place_id,
      name: item.name,
      address: item.address,
      formatted_phone_number: item.formatted_phone_number,
      website: item.website,
      note: item.note || '',
      custom_message: item.custom_message || '',
      place_description: item.place_description || ''
    }, callback);
  }

  function getGeminiKeysCount(callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), 0);
    request('GET', '/api/gemini-keys-count', null, function (err, data) {
      if (err) return callback(err, 0);
      var n = (data && typeof data.count === 'number') ? data.count : 0;
      callback(null, n);
    });
  }

  function generatePlaceDescription(place, callback) {
    if (!getToken()) return callback(null, '');
    var body = {
      name: place.name || '',
      address: place.vicinity || place.address || '',
      type: (place.types && place.types[0]) ? place.types[0].replace(/_/g, ' ') : ''
    };
    request('POST', '/api/generate-place-description', body, function (err, data) {
      if (err) return callback(err, '');
      callback(null, (data && data.description) ? data.description : '');
    });
  }

  function generatePlaceDescriptionWithKeyIndex(place, keyIndex, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), '');
    var body = {
      name: place.name || '',
      address: place.vicinity || place.address || '',
      type: (place.types && place.types[0]) ? place.types[0].replace(/_/g, ' ') : '',
      keyIndex: keyIndex
    };
    request('POST', '/api/generate-place-description', body, function (err, data) {
      if (err) {
        if (err.data && err.data.retry_in_seconds != null) err.retryInSeconds = err.data.retry_in_seconds;
        return callback(err, '');
      }
      callback(null, (data && data.description) ? data.description : '');
    });
  }

  function generateCustomMessageFromDescription(description, businessName, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), '');
    var body = { description: description || '', businessName: businessName || '' };
    request('POST', '/api/generate-custom-message', body, function (err, data) {
      if (err) return callback(err, '');
      callback(null, (data && data.message) ? data.message : '');
    });
  }

  function removePosibleClienteFromServer(placeId, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), null);
    var enc = encodeURIComponent(placeId);
    request('DELETE', '/api/posibles-clientes/' + enc, null, callback);
  }

  function updateNoteOnServer(placeId, note, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), null);
    var enc = encodeURIComponent(placeId);
    request('PATCH', '/api/posibles-clientes/' + enc, { note: note || '' }, callback);
  }

  function updateCustomMessageOnServer(placeId, custom_message, currentNote, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), null);
    var enc = encodeURIComponent(placeId);
    request('PATCH', '/api/posibles-clientes/' + enc, { note: currentNote || '', custom_message: custom_message || '' }, callback);
  }

  function updateStatusOnServer(placeId, status, callback) {
    if (!getToken()) return callback(new Error('No hay sesión'), null);
    var enc = encodeURIComponent(placeId);
    request('PATCH', '/api/posibles-clientes/' + enc, { status: status || '' }, callback);
  }

  global.AuthApi = {
    getToken: getToken,
    setToken: setToken,
    getStoredUser: getStoredUser,
    logout: logout,
    register: register,
    login: login,
    getPosiblesClientesFromServer: getPosiblesClientesFromServer,
    addPosibleClienteToServer: addPosibleClienteToServer,
    getGeminiKeysCount: getGeminiKeysCount,
    generatePlaceDescription: generatePlaceDescription,
    generatePlaceDescriptionWithKeyIndex: generatePlaceDescriptionWithKeyIndex,
    generateCustomMessageFromDescription: generateCustomMessageFromDescription,
    removePosibleClienteFromServer: removePosibleClienteFromServer,
    updateNoteOnServer: updateNoteOnServer,
    updateCustomMessageOnServer: updateCustomMessageOnServer,
    updateStatusOnServer: updateStatusOnServer
  };
})(typeof window !== 'undefined' ? window : this);
