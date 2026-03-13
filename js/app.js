/**
 * Orquestación: geolocalización, carga de negocios cercanos, mapa, lista, panel detalle y posibles clientes (localStorage).
 */

(function (global) {
  'use strict';

  var userLat = null;
  var userLng = null;
  var searchLat = null;
  var searchLng = null;
  var currentPlaces = [];
  var currentPlacesFromNameSearch = false;
  var STORAGE_KEY = 'donde_esta_posibles_clientes';
  var _posiblesClientesList = [];
  var lastDetailDescription = '';

  var CONFIG = global.CONFIG || {};
  var Sanitize = global.Sanitize;
  var MapsApi = global.MapsApi;
  var SearchLogic = global.SearchLogic;
  var UI = global.UI;
  var AuthApi = global.AuthApi || { getToken: function () { return ''; } };

  var STATUS_LABELS = { '': 'Sin estado', 'escribirle': 'Escribirle', 'esperando_respuesta': 'Esperando respuesta', 'rechazado': 'Rechazado' };
  function getStatusLabel(value) { return STATUS_LABELS[value] || value || 'Sin estado'; }

  function hasCoords() {
    return userLat != null && userLng != null;
  }

  function hasSearchCoords() {
    return searchLat != null && searchLng != null;
  }

  function setSearchCenter(lat, lng) {
    searchLat = lat;
    searchLng = lng;
  }

  function setPosiblesClientesList(list) {
    _posiblesClientesList = Array.isArray(list) ? list : [];
    if (!AuthApi.getToken()) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_posiblesClientesList)); } catch (e) {}
    }
  }

  function getPosiblesClientes() {
    return _posiblesClientesList;
  }

  function savePosiblesClientes(list) {
    _posiblesClientesList = Array.isArray(list) ? list : [];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_posiblesClientesList)); } catch (e) {}
  }

  function loadPosiblesClientes(callback) {
    if (AuthApi.getToken()) {
      AuthApi.getPosiblesClientesFromServer(function (err, list) {
        if (err) setPosiblesClientesList([]);
        else {
          var normalized = (list || []).map(function (p) {
            return {
              place_id: p.place_id,
              name: p.name,
              address: p.address,
              formatted_phone_number: p.formatted_phone_number || '',
              hasWebsite: !!(p.website && p.website.trim()),
              website: p.website || '',
              note: p.note || '',
              custom_message: p.custom_message || '',
              place_description: p.place_description || '',
              status: (p.status && String(p.status).trim()) ? String(p.status).trim() : '',
              statusLabel: getStatusLabel((p.status && String(p.status).trim()) ? String(p.status).trim() : ''),
              addedAt: p.addedAt || new Date().toISOString()
            };
          });
          setPosiblesClientesList(normalized);
        }
        if (callback) callback();
      });
    } else {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        var arr = raw ? JSON.parse(raw) : [];
        setPosiblesClientesList(Array.isArray(arr) ? arr : []);
      } catch (e) { setPosiblesClientesList([]); }
      if (callback) callback();
    }
  }

  function refreshPosiblesClientesUI() {
    UI.updatePosiblesClientes(
      getPosiblesClientes(),
      openDetailFromPosible,
      function (item, checked) {
        updateStatus(item.place_id, checked ? 'esperando_respuesta' : '');
      },
      function (item) {
        removePosibleCliente(item.place_id);
      }
    );
    renderPosiblesExtended();
    if (currentPlaces.length) applyFilters();
  }

  function renderPosiblesExtended() {
    var list = getPosiblesClientes();
    var container = document.getElementById('posiblesExtendedList');
    var emptyEl = document.getElementById('posiblesExtendedEmpty');
    var section = document.getElementById('posiblesExtendedSection');
    if (!container || !emptyEl || !section) return;
    if (list.length === 0) {
      container.innerHTML = '';
      emptyEl.style.display = 'block';
      container.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    container.style.display = 'block';
    container.innerHTML = '';
    list.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'posibles-extended-card';
      var nameEl = document.createElement('h3');
      nameEl.className = 'posibles-extended-card-name';
      nameEl.textContent = item.name || 'Sin nombre';
      card.appendChild(nameEl);
      var statusEl = document.createElement('p');
      statusEl.className = item.statusLabel && item.statusLabel !== 'Sin estado' ? 'posibles-extended-status' : 'posibles-extended-status posibles-extended-status-muted';
      statusEl.textContent = item.statusLabel && item.statusLabel !== 'Sin estado' ? item.statusLabel : 'Sin estado';
      card.appendChild(statusEl);
      if (item.place_description) {
        var descLabel = document.createElement('p');
        descLabel.className = 'posibles-extended-label';
        descLabel.textContent = 'Descripción del lugar';
        card.appendChild(descLabel);
        var descEl = document.createElement('p');
        descEl.className = 'posibles-extended-desc';
        descEl.textContent = item.place_description;
        card.appendChild(descEl);
      }
      if (item.custom_message) {
        var msgLabel = document.createElement('p');
        msgLabel.className = 'posibles-extended-label';
        msgLabel.textContent = 'Mensaje personalizado';
        card.appendChild(msgLabel);
        var msgEl = document.createElement('p');
        msgEl.className = 'posibles-extended-msg';
        msgEl.textContent = item.custom_message;
        card.appendChild(msgEl);
      }
      if (item.address) {
        var addr = document.createElement('p');
        addr.className = 'posibles-extended-meta';
        addr.textContent = '📍 ' + item.address;
        card.appendChild(addr);
      }
      if (item.formatted_phone_number) {
        var tel = document.createElement('p');
        tel.className = 'posibles-extended-meta';
        var a = document.createElement('a');
        a.href = 'tel:' + item.formatted_phone_number.replace(/[^\d+\-\s]/g, '').replace(/\s/g, '');
        a.textContent = '📞 ' + item.formatted_phone_number;
        tel.appendChild(a);
        card.appendChild(tel);
      }
      if (item.website && item.website.trim()) {
        var web = document.createElement('p');
        web.className = 'posibles-extended-meta';
        var link = document.createElement('a');
        link.href = item.website.indexOf('http') === 0 ? item.website : 'https://' + item.website;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '🌐 Sitio web';
        web.appendChild(link);
        card.appendChild(web);
      }
      if (item.note) {
        var noteLabel = document.createElement('p');
        noteLabel.className = 'posibles-extended-label';
        noteLabel.textContent = 'Tu nota';
        card.appendChild(noteLabel);
        var noteEl = document.createElement('p');
        noteEl.className = 'posibles-extended-note';
        noteEl.textContent = item.note;
        card.appendChild(noteEl);
      }
      var actions = document.createElement('div');
      actions.className = 'posibles-extended-card-actions';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-posibles-extended-detail';
      btn.textContent = 'Ver detalle';
      btn.addEventListener('click', function () { openDetailFromPosible(item); });
      actions.appendChild(btn);
      var btnQuitar = document.createElement('button');
      btnQuitar.type = 'button';
      btnQuitar.className = 'btn-posibles-extended-quitar';
      btnQuitar.textContent = 'Quitar de la lista';
      btnQuitar.addEventListener('click', function () { removePosibleCliente(item.place_id); });
      actions.appendChild(btnQuitar);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  function addPosibleCliente(place, customMessage) {
    if (getPosiblesClientes().some(function (p) { return p.place_id === place.place_id; })) return;
    var msg = typeof customMessage === 'string' ? customMessage.trim() : '';
    var item = {
      place_id: place.place_id,
      name: place.name,
      address: place.vicinity,
      formatted_phone_number: place.formatted_phone_number || '',
      hasWebsite: !!(place.website && place.website.trim()),
      website: place.website || '',
      note: '',
      custom_message: msg,
      place_description: '',
      status: '',
      statusLabel: getStatusLabel(''),
      addedAt: new Date().toISOString()
    };
    if (AuthApi.getToken()) {
      AuthApi.generatePlaceDescription(place, function (err, description) {
        if (err && err.data && err.data.code === 'ALL_QUOTAS_EXCEEDED' && typeof UI.showQuotaBreakPopup === 'function') UI.showQuotaBreakPopup();
        item.place_description = description || '';
        AuthApi.addPosibleClienteToServer(item, function (errAdd) {
          if (errAdd) { if (typeof UI.showError === 'function') UI.showError(errAdd.message || 'No se pudo agregar'); return; }
          loadPosiblesClientes(function () { refreshPosiblesClientesUI(); });
        });
      });
    } else {
      setPosiblesClientesList(getPosiblesClientes().concat([item]));
      refreshPosiblesClientesUI();
    }
  }

  function removePosibleCliente(placeId) {
    if (AuthApi.getToken()) {
      AuthApi.removePosibleClienteFromServer(placeId, function (err) {
        if (err) return;
        loadPosiblesClientes(function () { refreshPosiblesClientesUI(); });
      });
    } else {
      setPosiblesClientesList(getPosiblesClientes().filter(function (p) { return p.place_id !== placeId; }));
      refreshPosiblesClientesUI();
    }
  }

  function getNoteForPlace(placeId) {
    var item = getPosiblesClientes().filter(function (p) { return p.place_id === placeId; })[0];
    return item && typeof item.note === 'string' ? item.note : '';
  }

  function getCustomMessageForPlace(placeId) {
    var item = getPosiblesClientes().filter(function (p) { return p.place_id === placeId; })[0];
    return item && typeof item.custom_message === 'string' ? item.custom_message : '';
  }

  function getPlaceDescriptionForPlace(placeId) {
    var item = getPosiblesClientes().filter(function (p) { return p.place_id === placeId; })[0];
    return item && typeof item.place_description === 'string' ? item.place_description : '';
  }

  function getStatusForPlace(placeId) {
    var item = getPosiblesClientes().filter(function (p) { return p.place_id === placeId; })[0];
    return item && typeof item.status === 'string' ? item.status : '';
  }

  function updateStatus(placeId, status) {
    var list = getPosiblesClientes();
    var newStatus = typeof status === 'string' ? status : '';
    if (AuthApi.getToken()) {
      AuthApi.updateStatusOnServer(placeId, newStatus, function (err) {
        if (err) return;
        var idx = list.findIndex(function (p) { return p.place_id === placeId; });
        if (idx !== -1) {
          var copy = list.slice();
          copy[idx] = Object.assign({}, copy[idx], { status: newStatus, statusLabel: getStatusLabel(newStatus) });
          setPosiblesClientesList(copy);
        }
        refreshPosiblesClientesUI();
      });
    } else {
      var updated = list.map(function (p) {
        if (p.place_id === placeId) {
          var out = {}; for (var k in p) out[k] = p[k];
          out.status = newStatus;
          out.statusLabel = getStatusLabel(newStatus);
          return out;
        }
        return p;
      });
      setPosiblesClientesList(updated);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
      refreshPosiblesClientesUI();
    }
  }

  function updateCustomMessage(placeId, message) {
    var list = getPosiblesClientes();
    var msg = typeof message === 'string' ? message : '';
    if (AuthApi.getToken()) {
      AuthApi.updateCustomMessageOnServer(placeId, msg, getNoteForPlace(placeId), function (err) {
        if (err) return;
        var idx = list.findIndex(function (p) { return p.place_id === placeId; });
        if (idx !== -1) {
          var copy = list.slice();
          copy[idx] = Object.assign({}, copy[idx], { custom_message: msg });
          setPosiblesClientesList(copy);
        }
        refreshPosiblesClientesUI();
      });
    } else {
      var updated = list.map(function (p) {
        if (p.place_id === placeId) {
          var out = {}; for (var k in p) out[k] = p[k];
          out.custom_message = msg;
          return out;
        }
        return p;
      });
      setPosiblesClientesList(updated);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
      refreshPosiblesClientesUI();
    }
  }

  function updateNote(placeId, note) {
    var list = getPosiblesClientes();
    if (AuthApi.getToken()) {
      AuthApi.updateNoteOnServer(placeId, note, function (err) {
        if (err) return;
        var idx = list.findIndex(function (p) { return p.place_id === placeId; });
        if (idx !== -1) {
          var copy = list.slice();
          copy[idx] = Object.assign({}, copy[idx], { note: typeof note === 'string' ? note : '' });
          setPosiblesClientesList(copy);
        }
        refreshPosiblesClientesUI();
      });
    } else {
      var updated = list.map(function (p) {
        if (p.place_id === placeId) {
          var out = {}; for (var k in p) out[k] = p[k];
          out.note = typeof note === 'string' ? note : '';
          return out;
        }
        return p;
      });
      savePosiblesClientes(updated);
      refreshPosiblesClientesUI();
    }
  }

  function isPosibleCliente(placeId) {
    return getPosiblesClientes().some(function (p) { return p.place_id === placeId; });
  }

  function getPosiblesPlaceIds() {
    return getPosiblesClientes().map(function (p) { return p.place_id; });
  }

  function sortPlaces(places, order) {
    var list = places.slice();
    if (order === 'rating') {
      list.sort(function (a, b) {
        var ra = a.rating != null ? a.rating : -1;
        var rb = b.rating != null ? b.rating : -1;
        return rb - ra;
      });
    } else if (order === 'rating_bajo') {
      list.sort(function (a, b) {
        var ra = a.rating != null ? a.rating : -1;
        var rb = b.rating != null ? b.rating : -1;
        return ra - rb;
      });
    } else if (order === 'reviews') {
      list.sort(function (a, b) {
        var na = a.user_ratings_total != null ? a.user_ratings_total : -1;
        var nb = b.user_ratings_total != null ? b.user_ratings_total : -1;
        return nb - na;
      });
    } else if (order === 'reviews_menos') {
      list.sort(function (a, b) {
        var na = a.user_ratings_total != null ? a.user_ratings_total : -1;
        var nb = b.user_ratings_total != null ? b.user_ratings_total : -1;
        return na - nb;
      });
    } else if (order === 'cercania_lejos') {
      list.sort(function (a, b) {
        var da = a.distanceMeters != null ? a.distanceMeters : 0;
        var db = b.distanceMeters != null ? b.distanceMeters : 0;
        return db - da;
      });
    } else {
      list.sort(function (a, b) {
        var da = a.distanceMeters != null ? a.distanceMeters : Infinity;
        var db = b.distanceMeters != null ? b.distanceMeters : Infinity;
        return da - db;
      });
    }
    return list;
  }

  function applyFilters() {
    if (!currentPlaces.length) return;
    var categoryId = UI.getCategoryFilter();
    var onlyPosibles = UI.getOnlyPosiblesClientes();
    var onlySinWeb = UI.getOnlySinWeb();
    var posiblesIds = getPosiblesPlaceIds();

    var filtered = currentPlacesFromNameSearch
      ? currentPlaces.slice()
      : SearchLogic.filterPlacesByCategory(currentPlaces, categoryId);
    var subcategoryType = UI.getSubcategoryFilter();
    if (categoryId && categoryId !== 'all' && subcategoryType && subcategoryType !== 'all') {
      filtered = SearchLogic.filterPlacesBySubcategory(filtered, subcategoryType);
    }
    if (onlyPosibles) filtered = SearchLogic.filterPlacesByPosiblesClientes(filtered, posiblesIds);
    if (onlySinWeb) filtered = SearchLogic.filterPlacesBySinWeb(filtered);

    var sortBy = UI.getSortOrder();
    filtered = sortPlaces(filtered, sortBy);

    MapsApi.clearMarkers();
    if (filtered.length === 0) {
      UI.hideStates();
      UI.get('listHeader').style.display = 'none';
      UI.get('emptyState').classList.add('visible');
      var msg = onlyPosibles
        ? 'No tenés posibles clientes en esta zona o categoría.'
        : onlySinWeb
          ? 'No hay negocios sin página web en esta zona o categoría.'
          : 'No hay negocios en esta categoría en la zona cargada.';
      UI.get('emptyState').querySelector('p').textContent = msg;
      return;
    }

    UI.showListHeader(filtered.length);
    var cards = [];
    filtered.forEach(function (place, index) {
      cards.push(SearchLogic.buildListCard(place, index, openDetail));
    });
    UI.renderListCards(cards);

    filtered.forEach(function (place) {
      var raw = { place_id: place.place_id, name: place.name, geometry: place.geometry };
      var isPosible = posiblesIds.indexOf(place.place_id) !== -1;
      var sinWeb = !(place.website && place.website.trim());
      MapsApi.addMarker(raw, function () { openDetail(place); }, { isPosibleCliente: isPosible, sinWeb: sinWeb });
    });
    MapsApi.setMapCenter(searchLat, searchLng);
    var map = MapsApi.getMap();
    if (map) map.setZoom(15);
  }

  function getPlacesErrorMessage(status) {
    var statusStr = String(status || '');
    var msg = 'Error de la API: ' + statusStr + '. ';
    if (statusStr === 'REQUEST_DENIED') {
      msg += 'Usá una API key (no OAuth). En Credenciales creá una "Clave de API", habilitá Maps JavaScript API y Places API.';
    } else if (statusStr === 'OVER_QUERY_LIMIT') {
      msg += 'Superaste el límite de la API. Revisá la facturación en Google Cloud.';
    } else {
      msg += 'Revisá la API key y que Maps JavaScript API y Places API estén habilitadas.';
    }
    return msg;
  }

  function requestLocation() {
    UI.setLocationMessage('Permití el acceso a tu ubicación para cargar negocios.');
    UI.setFallbackVisible(false);
    if (!navigator.geolocation) {
      UI.setLocationStatus('Tu navegador no soporta geolocalización.');
      showFallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        setSearchCenter(userLat, userLng);
        UI.setLocationSectionHidden(true);
        UI.setHeaderActionsVisible(true);
        UI.setLoadPlacesEnabled(true);
        UI.setBarrioWrapVisible(true);
        MapsApi.setMapCenter(userLat, userLng);
      },
      function () {
        UI.setLocationMessage('No pudimos usar tu ubicación.');
        UI.setLocationStatus('Ingresá una ciudad para buscar ahí.');
        showFallback();
      }
    );
  }

  function showFallback() {
    UI.setFallbackVisible(true);
    var citySearchBtn = UI.get('citySearchBtn');
    var cityInput = UI.get('cityInput');
    if (!citySearchBtn || !cityInput) return;
    citySearchBtn.onclick = function () {
      var result = Sanitize.validateCity(cityInput.value);
      if (!result.valid) {
        UI.setLocationStatus(result.error || 'Ingresá una ciudad.');
        return;
      }
      UI.setLocationStatus('Buscando…');
      var address = result.value + ', Argentina';
      MapsApi.geocode(address, function (results, status) {
        if (status === 'OK' && results && results[0]) {
          var loc = results[0].geometry.location;
          userLat = loc.lat();
          userLng = loc.lng();
          setSearchCenter(userLat, userLng);
          UI.setLocationSectionHidden(true);
          UI.setHeaderActionsVisible(true);
          UI.setLoadPlacesEnabled(true);
          UI.setBarrioWrapVisible(true);
          UI.setLocationStatus('');
          MapsApi.setMapCenter(userLat, userLng);
        } else {
          UI.setLocationStatus('No encontramos esa ciudad. Probá de nuevo.');
        }
      });
    };
  }

  /** URL correcta para abrir la ficha del lugar en Google Maps (no la búsqueda). */
  function getMapsPlaceUrl(place) {
    if (place && place.place_id) {
      return 'https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(place.place_id);
    }
    return (place && place.url) ? place.url : '#';
  }

  /** Abre el detalle desde un ítem de la lista de posibles clientes (por si no está en currentPlaces). */
  function openDetailFromPosible(item) {
    var place = currentPlaces.filter(function (p) { return p.place_id === item.place_id; })[0];
    if (place) {
      openDetail(place);
      return;
    }
    var minimalPlace = {
      place_id: item.place_id,
      name: item.name || 'Sin nombre',
      vicinity: item.address || '',
      formatted_phone_number: item.formatted_phone_number || '',
      website: item.website || '',
      url: getMapsPlaceUrl({ place_id: item.place_id }),
      rating: null,
      user_ratings_total: null,
      zone: '',
      types: []
    };
    openDetail(minimalPlace);
  }

  function openDetail(place) {
    if (place && place.place_id) place.url = getMapsPlaceUrl(place);
    lastDetailDescription = '';
    var isPosible = isPosibleCliente(place.place_id);
    var currentNote = getNoteForPlace(place.place_id);
    var currentCustomMessage = getCustomMessageForPlace(place.place_id);
    var defaultPitch = SearchLogic.generatePitchMessage ? SearchLogic.generatePitchMessage(place) : '';
    var currentStatus = getStatusForPlace(place.place_id);
    var html = SearchLogic.buildDetailPanelContent(
      place,
      isPosible,
      currentNote,
      currentCustomMessage,
      currentStatus,
      defaultPitch,
      function (customMessage) {
        addPosibleCliente(place, customMessage);
        openDetail(place);
      },
      function () {
        removePosibleCliente(place.place_id);
        openDetail(place);
      },
      function (note) {
        updateNote(place.place_id, note);
        openDetail(place);
      },
      function (message) {
        updateCustomMessage(place.place_id, message);
        openDetail(place);
      }
    );
    UI.showDetailPanel(html, function () {
      var btnMark = document.getElementById('btnMarkPosibleCliente');
      var btnUnmark = document.getElementById('btnUnmarkPosibleCliente');
      var btnSaveNote = document.getElementById('btnSaveNote');
      var noteInput = document.getElementById('detailNoteInput');
      var msgInput = document.getElementById('detailCustomMessageInput');
      var btnSaveMsg = document.getElementById('btnSaveCustomMessage');
      var descWrap = document.getElementById('detailDescriptionWrap');
      var btnGenerarMsg = document.getElementById('btnGenerarMensajeCliente');

      function setDescriptionInPanel(description, isError, errorMessage) {
        lastDetailDescription = description || '';
        if (!descWrap) return;
        if (isError) {
          var msg = (errorMessage && errorMessage.trim()) ? errorMessage.trim() : 'No se pudo generar la descripción.';
          var escaped = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          descWrap.innerHTML = '<p class="detail-description-text detail-description-error">' + escaped + '</p>';
          return;
        }
        if (!description || !description.trim()) {
          if (!AuthApi.getToken()) {
            descWrap.innerHTML = '<p class="detail-description-text detail-description-muted">Iniciá sesión para generar la descripción con IA.</p>';
          } else {
            descWrap.innerHTML = '<p class="detail-description-text detail-description-muted">No hay descripción para este negocio.</p>';
          }
          return;
        }
        var escaped = description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        descWrap.innerHTML = '<p class="detail-description-label">Descripción del lugar</p><p class="detail-description-text">' + escaped + '</p>';
      }

      function runGenerateMessage() {
        if (!lastDetailDescription || !lastDetailDescription.trim() || !AuthApi.getToken()) return;
        if (msgInput) {
          msgInput.value = '';
          msgInput.placeholder = 'Generando mensaje…';
          msgInput.disabled = true;
        }
        if (btnGenerarMsg) {
          btnGenerarMsg.disabled = true;
          btnGenerarMsg.textContent = 'Generando…';
        }
        AuthApi.generateCustomMessageFromDescription(lastDetailDescription, place.name, function (err, message) {
          if (msgInput) {
            msgInput.disabled = false;
            msgInput.placeholder = 'Mensaje de oferta de tu servicio...';
            msgInput.value = err ? '' : (message || '');
          }
          if (btnGenerarMsg) {
            btnGenerarMsg.disabled = false;
            btnGenerarMsg.textContent = 'Generar mensaje para el cliente';
          }
          if (err) {
            if (err.data && err.data.code === 'ALL_QUOTAS_EXCEEDED' && typeof UI.showQuotaBreakPopup === 'function') UI.showQuotaBreakPopup();
            else if (msgInput) msgInput.placeholder = 'No se pudo generar. Reintentá con el botón.';
          }
        });
      }

      function runDescriptionWithProgress() {
        AuthApi.getGeminiKeysCount(function (errCount, count) {
          if (errCount || !count) {
            setDescriptionInPanel('', true, 'No se pudo cargar la descripción.');
            if (btnGenerarMsg) btnGenerarMsg.disabled = true;
            return;
          }
          var retrySecondsByKey = [];
          var keyOrder = [];
          for (var k = 0; k < count; k++) keyOrder.push(k);
          var idx = 0;
          function tryNextKey(order) {
            if (idx >= order.length) {
              var minSec = null;
              var bestIdx = 0;
              for (var j = 0; j < retrySecondsByKey.length; j++) {
                if (retrySecondsByKey[j] != null && (minSec === null || retrySecondsByKey[j] < minSec)) {
                  minSec = retrySecondsByKey[j];
                  bestIdx = j;
                }
              }
              if (descWrap) {
                descWrap.innerHTML = '<div class="detail-description-error-wrap"><p class="detail-description-text detail-description-error">No se pudo cargar la descripción.</p>' +
                  '<button type="button" class="btn-detail-retry-description" id="btnRetryDescription">Reintentar</button></div>';
                var btnRetry = document.getElementById('btnRetryDescription');
                if (btnRetry) {
                  btnRetry.onclick = function () {
                    var waitMs = (minSec != null && minSec > 0) ? minSec * 1000 : 0;
                    if (waitMs > 0 && descWrap) descWrap.innerHTML = '<p class="detail-description-text">Reintentando en ' + minSec + ' s (key con menor espera)…</p>';
                    setTimeout(function () {
                      var retryOrder = [bestIdx];
                      for (var r = 0; r < count; r++) { if (r !== bestIdx) retryOrder.push(r); }
                      idx = 0;
                      retrySecondsByKey.length = 0;
                      if (descWrap) descWrap.innerHTML = '<p class="detail-description-loading">Intentando 1/' + count + '…</p>';
                      tryNextKey(retryOrder);
                    }, waitMs);
                  };
                }
              }
              if (btnGenerarMsg) btnGenerarMsg.disabled = true;
              return;
            }
            var keyIdx = order[idx];
            if (descWrap) descWrap.innerHTML = '<p class="detail-description-loading">Intentando ' + (idx + 1) + '/' + count + '…</p>';
            AuthApi.generatePlaceDescriptionWithKeyIndex(place, keyIdx, function (err, description) {
              if (!err && description && description.trim()) {
                setDescriptionInPanel(description, false);
                if (btnGenerarMsg) btnGenerarMsg.disabled = false;
                if (lastDetailDescription && lastDetailDescription.trim()) setTimeout(runGenerateMessage, 400);
                return;
              }
              if (err && err.retryInSeconds != null) retrySecondsByKey[keyIdx] = err.retryInSeconds;
              idx++;
              tryNextKey(order);
            });
          }
          tryNextKey(keyOrder);
        });
      }

      var savedDescription = getPlaceDescriptionForPlace(place.place_id);
      if (savedDescription && savedDescription.trim()) {
        setDescriptionInPanel(savedDescription, false);
        if (btnGenerarMsg) btnGenerarMsg.disabled = false;
        if (AuthApi.getToken()) setTimeout(runGenerateMessage, 400);
      } else if (AuthApi.getToken()) {
        runDescriptionWithProgress();
      } else {
        setDescriptionInPanel('', false);
        if (btnGenerarMsg) btnGenerarMsg.disabled = true;
      }

      if (btnGenerarMsg) {
        btnGenerarMsg.onclick = function () {
          if (!lastDetailDescription || !lastDetailDescription.trim()) {
            if (typeof UI.showError === 'function') UI.showError('Primero se genera la descripción del negocio.');
            return;
          }
          runGenerateMessage();
        };
      }

      if (btnMark) btnMark.onclick = function () {
        var msg = msgInput ? msgInput.value : '';
        addPosibleCliente(place, msg);
        openDetail(place);
      };
      if (btnUnmark) btnUnmark.onclick = function () { removePosibleCliente(place.place_id); openDetail(place); };
      var statusSelect = document.getElementById('detailStatusSelect');
      if (statusSelect) statusSelect.onchange = function () { updateStatus(place.place_id, statusSelect.value); };
      if (btnSaveNote && noteInput) {
        var saveNoteBtn = document.getElementById('btnSaveNote');
        if (saveNoteBtn) saveNoteBtn.onclick = function () {
          updateNote(place.place_id, noteInput.value || '');
          openDetail(place);
        };
      }
      if (btnSaveMsg && msgInput) {
        btnSaveMsg.onclick = function () {
          updateCustomMessage(place.place_id, msgInput.value || '');
          openDetail(place);
        };
      }
    });
  }

  function runSearchByName() {
    var input = UI.get('searchByNameInput');
    var query = input ? (input.value || '').trim() : '';
    if (!query) {
      UI.showError('Escribí el nombre del negocio que querés buscar.');
      return;
    }
    if (!hasSearchCoords()) {
      UI.showError('Necesitamos una ubicación. Elegí zona o permití la tuya.');
      return;
    }

    UI.hideStates();
    UI.showListHeader(0);
    UI.showSkeleton(true);

    MapsApi.textSearch(
      { query: query, lat: searchLat, lng: searchLng },
      function (results, status) {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
          UI.showSkeleton(false);
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            UI.showEmpty();
            var emptyP = UI.get('emptyState') && UI.get('emptyState').querySelector('p');
            if (emptyP) emptyP.textContent = 'No encontramos ningún negocio con ese nombre en la zona.';
          } else {
            UI.showError(getPlacesErrorMessage(status));
          }
          return;
        }

        SearchLogic.processNearbyResults({
          results: results.slice(0, 20),
          lat: searchLat,
          lng: searchLng
        }).then(function (data) {
          UI.showSkeleton(false);
          currentPlacesFromNameSearch = true;
          currentPlaces = data.places;
          if (currentPlaces.length === 0) {
            UI.showEmpty();
            return;
          }
          UI.setFilterRowVisible(true);
          applyFilters();
        }).catch(function () {
          UI.showSkeleton(false);
          UI.showError('Error al cargar los detalles.');
        });
      }
    );
  }

  function runLoadPlaces() {
    if (!hasSearchCoords()) {
      UI.showError('Necesitamos una ubicación. Permití la tuya o ingresá una ciudad.');
      return;
    }

    UI.hideStates();
    UI.showListHeader(0);
    UI.showSkeleton(true);

    MapsApi.nearbySearchMultipleTypes(
      {
        lat: searchLat,
        lng: searchLng,
        radius: 2500,
        types: ['restaurant', 'cafe', 'store', 'bar', 'gym', 'bakery', 'pharmacy', 'hair_care', 'real_estate_agency'],
        maxTotal: 200
      },
      function (results, status) {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
          UI.showSkeleton(false);
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            UI.showEmpty();
          } else {
            UI.showError(getPlacesErrorMessage(status));
          }
          return;
        }

        var batch1 = results.slice(0, 100);
        var batch2 = results.length > 100 ? results.slice(100, 200) : [];

        SearchLogic.processNearbyResults({
          results: batch1,
          lat: searchLat,
          lng: searchLng
        }).then(function (data1) {
          var places = (data1.places || []).filter(function (p) {
            return SearchLogic.placeMatchesCategory(p, 'all');
          });
          currentPlacesFromNameSearch = false;
          currentPlaces = places;

          if (places.length === 0 && batch2.length === 0) {
            UI.showSkeleton(false);
            UI.showEmpty();
            return;
          }

          UI.setFilterRowVisible(true);
          applyFilters();
          UI.showSkeleton(false);

          if (batch2.length === 0) return null;
          return SearchLogic.processNearbyResults({
            results: batch2,
            lat: searchLat,
            lng: searchLng
          });
        }).then(function (data2) {
          if (!data2 || !data2.places || !data2.places.length) return;
          var extra = data2.places.filter(function (p) {
            return SearchLogic.placeMatchesCategory(p, 'all');
          });
          var seen = {};
          currentPlaces.forEach(function (p) { seen[p.place_id] = true; });
          extra = extra.filter(function (p) { return !seen[p.place_id]; });
          if (extra.length === 0) return;
          var combined = currentPlaces.concat(extra);
          combined.sort(function (a, b) { return (a.distanceMeters || 0) - (b.distanceMeters || 0); });
          currentPlaces = combined;
          applyFilters();
        }).catch(function () {
          UI.showSkeleton(false);
          UI.showError('Error al cargar los detalles de los negocios.');
        });
      }
    );
  }

  function bindBarrioSelect() {
    var barrioSelect = UI.get('barrioSelect');
    if (!barrioSelect) return;
    barrioSelect.addEventListener('change', function () {
      var value = (barrioSelect.value || '').trim();
      if (value === '') {
        setSearchCenter(userLat, userLng);
        MapsApi.setMapCenter(userLat, userLng);
        return;
      }
      var address = value + ', Argentina';
      MapsApi.geocode(address, function (results, status) {
        if (status === 'OK' && results && results[0]) {
          var loc = results[0].geometry.location;
          setSearchCenter(loc.lat(), loc.lng());
          MapsApi.setMapCenter(loc.lat(), loc.lng());
        }
      });
    });
  }

  function bindEvents() {
    var loadPlacesBtn = UI.get('loadPlacesBtn');
    var retryBtn = UI.get('retryBtn');
    var detailClose = UI.get('detailClose');
    var detailOverlay = UI.get('detailOverlay');
    var categoryFilter = UI.get('categoryFilter');
    var filterPosiblesClientes = UI.get('filterPosiblesClientes');
    var searchByNameBtn = UI.get('searchByNameBtn');
    var searchByNameInput = UI.get('searchByNameInput');

    bindBarrioSelect();
    if (loadPlacesBtn) loadPlacesBtn.addEventListener('click', runLoadPlaces);
    if (retryBtn) retryBtn.addEventListener('click', runLoadPlaces);
    if (searchByNameBtn) searchByNameBtn.addEventListener('click', runSearchByName);
    if (searchByNameInput) {
      searchByNameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') runSearchByName();
      });
    }
    if (detailClose) detailClose.addEventListener('click', UI.hideDetailPanel);
    var detailPanel = UI.get('detailPanel');
    if (detailPanel) {
      detailPanel.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (e) {
        if (e.target === detailOverlay) UI.hideDetailPanel();
      });
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', function () {
        var categoryId = UI.getCategoryFilter();
        if (categoryId === 'all') {
          UI.setSubcategoryFilterVisible(false);
        } else {
          var opts = SearchLogic.getSubcategoriesForCategory(categoryId);
          UI.setSubcategoryOptions(opts);
          UI.setSubcategoryFilterVisible(true);
        }
        applyFilters();
      });
    }
    var subcategoryFilter = UI.get('subcategoryFilter');
    if (subcategoryFilter) subcategoryFilter.addEventListener('change', applyFilters);
    if (filterPosiblesClientes) filterPosiblesClientes.addEventListener('change', applyFilters);
    var filterSinWeb = UI.get('filterSinWeb');
    if (filterSinWeb) filterSinWeb.addEventListener('change', applyFilters);
    var sortOrder = UI.get('sortOrder');
    if (sortOrder) sortOrder.addEventListener('change', applyFilters);
  }

  function refreshAuthUI() {
    var token = AuthApi.getToken();
    var guestEl = document.getElementById('authGuest');
    var userEl = document.getElementById('authUser');
    var emailEl = document.getElementById('authUserEmail');
    if (guestEl) guestEl.style.display = token ? 'none' : '';
    if (userEl) userEl.style.display = token ? 'flex' : 'none';
    if (emailEl && token) {
      var u = AuthApi.getStoredUser();
      emailEl.textContent = u && u.email ? u.email : '';
    }
  }

  function openAuthModal() {
    var overlay = document.getElementById('authOverlay');
    if (overlay) { overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); }
    document.getElementById('authErrorLogin').textContent = '';
    document.getElementById('authErrorRegister').textContent = '';
    var tabLogin = document.getElementById('authTabLogin');
    var tabReg = document.getElementById('authTabRegister');
    if (tabLogin) tabLogin.classList.add('active');
    if (tabReg) tabReg.classList.remove('active');
    document.getElementById('authFormLogin').style.display = '';
    document.getElementById('authFormRegister').style.display = 'none';
  }

  function closeAuthModal() {
    var overlay = document.getElementById('authOverlay');
    if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
  }

  function bindAuthEvents() {
    var loginBtn = document.getElementById('authLoginBtn');
    var logoutBtn = document.getElementById('authLogoutBtn');
    var modalClose = document.getElementById('authModalClose');
    var authOverlay = document.getElementById('authOverlay');
    var tabLogin = document.getElementById('authTabLogin');
    var tabReg = document.getElementById('authTabRegister');
    var formLogin = document.getElementById('authFormLogin');
    var formReg = document.getElementById('authFormRegister');
    var errLogin = document.getElementById('authErrorLogin');
    var errReg = document.getElementById('authErrorRegister');

    if (loginBtn) loginBtn.addEventListener('click', openAuthModal);
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      AuthApi.logout();
      loadPosiblesClientes(function () {
        refreshAuthUI();
        refreshPosiblesClientesUI();
      });
    });
    if (modalClose) modalClose.addEventListener('click', closeAuthModal);
    if (authOverlay) authOverlay.addEventListener('click', function (e) { if (e.target === authOverlay) closeAuthModal(); });

    function showTab(tab) {
      if (tab === 'login') {
        if (tabLogin) tabLogin.classList.add('active'); if (tabReg) tabReg.classList.remove('active');
        if (formLogin) formLogin.style.display = ''; if (formReg) formReg.style.display = 'none';
        if (errLogin) errLogin.textContent = ''; if (errReg) errReg.textContent = '';
      } else {
        if (tabReg) tabReg.classList.add('active'); if (tabLogin) tabLogin.classList.remove('active');
        if (formReg) formReg.style.display = ''; if (formLogin) formLogin.style.display = 'none';
      }
    }
    if (tabLogin) tabLogin.addEventListener('click', function () { showTab('login'); });
    if (tabReg) tabReg.addEventListener('click', function () { showTab('register'); });

    if (formLogin) formLogin.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (document.getElementById('authEmailLogin').value || '').trim();
      var password = document.getElementById('authPasswordLogin').value || '';
      if (errLogin) errLogin.textContent = '';
      AuthApi.login(email, password, function (err, user) {
        if (err) { if (errLogin) errLogin.textContent = err.message || 'Error al iniciar sesión'; return; }
        closeAuthModal();
        refreshAuthUI();
        loadPosiblesClientes(function () { refreshPosiblesClientesUI(); });
      });
    });

    if (formReg) formReg.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (document.getElementById('authEmailRegister').value || '').trim();
      var password = document.getElementById('authPasswordRegister').value || '';
      if (errReg) errReg.textContent = '';
      if (password.length < 6) { if (errReg) errReg.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
      AuthApi.register(email, password, function (err, user) {
        if (err) { if (errReg) errReg.textContent = err.message || 'Error al registrarse'; return; }
        closeAuthModal();
        refreshAuthUI();
        loadPosiblesClientes(function () { refreshPosiblesClientesUI(); });
      });
    });
  }

  function initMap() {
    var mapContainer = UI.get('mapContainer');
    if (!MapsApi.initServices(mapContainer)) {
      UI.showError('No se pudo inicializar la API de mapas.');
      return;
    }
    requestLocation();
    bindEvents();
    bindAuthEvents();
    refreshAuthUI();
    loadPosiblesClientes(function () {
      refreshPosiblesClientesUI();
    });
  }

  function bootstrap() {
    var refs = {
      mapContainer: document.getElementById('mapContainer'),
      headerActions: document.getElementById('headerActions'),
      loadPlacesBtn: document.getElementById('loadPlacesBtn'),
      barrioSelect: document.getElementById('barrioSelect'),
      barrioWrap: document.getElementById('barrioWrap'),
      locationSection: document.getElementById('locationSection'),
      locationMessage: document.getElementById('locationMessage'),
      locationStatus: document.getElementById('locationStatus'),
      fallbackRow: document.getElementById('fallbackRow'),
      cityInput: document.getElementById('cityInput'),
      citySearchBtn: document.getElementById('citySearchBtn'),
      listHeader: document.getElementById('listHeader'),
      resultsTitle: document.getElementById('resultsTitle'),
      listCount: document.getElementById('listCount'),
      skeletonWrap: document.getElementById('skeletonWrap'),
      resultsSection: document.getElementById('resultsSection'),
      resultsList: document.getElementById('resultsList'),
      emptyState: document.getElementById('emptyState'),
      errorState: document.getElementById('errorState'),
      errorMessage: document.getElementById('errorMessage'),
      retryBtn: document.getElementById('retryBtn'),
      detailOverlay: document.getElementById('detailOverlay'),
      detailPanel: document.getElementById('detailPanel'),
      detailContent: document.getElementById('detailContent'),
      detailClose: document.getElementById('detailClose'),
      searchByNameWrap: document.getElementById('searchByNameWrap'),
      searchByNameInput: document.getElementById('searchByNameInput'),
      searchByNameBtn: document.getElementById('searchByNameBtn'),
      filterRow: document.getElementById('filterRow'),
      categoryFilter: document.getElementById('categoryFilter'),
      filterPosiblesClientes: document.getElementById('filterPosiblesClientes'),
      sortOrder: document.getElementById('sortOrder'),
      posiblesClientesWrap: document.getElementById('posiblesClientesWrap'),
      posiblesCount: document.getElementById('posiblesCount'),
      posiblesList: document.getElementById('posiblesList')
    };
    UI.init(refs);
    MapsApi.load();
  }

  global.initMap = initMap;
  global.onMapsApiError = function (msg) {
    UI.showError(msg);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(typeof window !== 'undefined' ? window : this);
