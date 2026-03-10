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

  var CONFIG = global.CONFIG || {};
  var Sanitize = global.Sanitize;
  var MapsApi = global.MapsApi;
  var SearchLogic = global.SearchLogic;
  var UI = global.UI;

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

  function getPosiblesClientes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function savePosiblesClientes(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function addPosibleCliente(place) {
    var list = getPosiblesClientes();
    if (list.some(function (p) { return p.place_id === place.place_id; })) return;
    list.push({
      place_id: place.place_id,
      name: place.name,
      address: place.vicinity,
      formatted_phone_number: place.formatted_phone_number || '',
      hasWebsite: !!(place.website && place.website.trim()),
      website: place.website || '',
      note: '',
      addedAt: new Date().toISOString()
    });
    savePosiblesClientes(list);
    UI.updatePosiblesClientes(list, openDetailFromPosible);
    if (currentPlaces.length) applyFilters();
  }

  function removePosibleCliente(placeId) {
    var list = getPosiblesClientes().filter(function (p) { return p.place_id !== placeId; });
    savePosiblesClientes(list);
    UI.updatePosiblesClientes(list, openDetailFromPosible);
    if (currentPlaces.length) applyFilters();
  }

  function getNoteForPlace(placeId) {
    var item = getPosiblesClientes().filter(function (p) { return p.place_id === placeId; })[0];
    return item && typeof item.note === 'string' ? item.note : '';
  }

  function updateNote(placeId, note) {
    var list = getPosiblesClientes().map(function (p) {
      if (p.place_id === placeId) {
        var out = {};
        for (var k in p) out[k] = p[k];
        out.note = typeof note === 'string' ? note : '';
        return out;
      }
      return p;
    });
    savePosiblesClientes(list);
    UI.updatePosiblesClientes(list, openDetailFromPosible);
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
    } else if (order === 'reviews') {
      list.sort(function (a, b) {
        var na = a.user_ratings_total != null ? a.user_ratings_total : -1;
        var nb = b.user_ratings_total != null ? b.user_ratings_total : -1;
        return nb - na;
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
      MapsApi.addMarker(raw, function () { openDetail(place); }, { isPosibleCliente: isPosible });
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
      url: 'https://www.google.com/maps/place/?q=place_id=' + encodeURIComponent(item.place_id),
      rating: null,
      user_ratings_total: null,
      zone: '',
      types: []
    };
    openDetail(minimalPlace);
  }

  function openDetail(place) {
    var isPosible = isPosibleCliente(place.place_id);
    var currentNote = getNoteForPlace(place.place_id);
    var html = SearchLogic.buildDetailPanelContent(
      place,
      isPosible,
      currentNote,
      function () {
        addPosibleCliente(place);
        openDetail(place);
      },
      function () {
        removePosibleCliente(place.place_id);
        openDetail(place);
      },
      function (note) {
        updateNote(place.place_id, note);
        openDetail(place);
      }
    );
    UI.showDetailPanel(html, function () {
      var btnMark = document.getElementById('btnMarkPosibleCliente');
      var btnUnmark = document.getElementById('btnUnmarkPosibleCliente');
      var btnSaveNote = document.getElementById('btnSaveNote');
      var noteInput = document.getElementById('detailNoteInput');
      if (btnMark) btnMark.onclick = function () { addPosibleCliente(place); openDetail(place); };
      if (btnUnmark) btnUnmark.onclick = function () { removePosibleCliente(place.place_id); openDetail(place); };
      if (btnSaveNote && noteInput) {
        btnSaveNote.onclick = function () {
          updateNote(place.place_id, noteInput.value || '');
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
        maxTotal: 100
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

        SearchLogic.processNearbyResults({
          results: results,
          lat: searchLat,
          lng: searchLng
        }).then(function (data) {
          UI.showSkeleton(false);
          var places = data.places.filter(function (p) {
            return SearchLogic.placeMatchesCategory(p, 'all');
          });
          currentPlacesFromNameSearch = false;
          currentPlaces = places;

          if (places.length === 0) {
            UI.showEmpty();
            return;
          }

          UI.setFilterRowVisible(true);
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
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (e) {
        if (e.target === detailOverlay) UI.hideDetailPanel();
      });
    }
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (filterPosiblesClientes) filterPosiblesClientes.addEventListener('change', applyFilters);
    var filterSinWeb = UI.get('filterSinWeb');
    if (filterSinWeb) filterSinWeb.addEventListener('change', applyFilters);
    var sortOrder = UI.get('sortOrder');
    if (sortOrder) sortOrder.addEventListener('change', applyFilters);
  }

  function initMap() {
    var mapContainer = UI.get('mapContainer');
    if (!MapsApi.initServices(mapContainer)) {
      UI.showError('No se pudo inicializar la API de mapas.');
      return;
    }
    requestLocation();
    bindEvents();
    UI.updatePosiblesClientes(getPosiblesClientes(), openDetailFromPosible);
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
