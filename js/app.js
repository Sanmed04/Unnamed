/**
 * Orquestación: geolocalización, búsqueda con cooldown, eventos.
 * Integra config, validación (OWASP), API y UI.
 */

(function (global) {
  'use strict';

  var userLat = null;
  var userLng = null;
  var searchLat = null;
  var searchLng = null;
  var debounceTimer = null;
  var lastSearchTime = 0;

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

  function getPlacesErrorMessage(status) {
    var statusStr = String(status || '');
    var msg = 'Error de la API: ' + statusStr + '. ';
    if (statusStr === 'REQUEST_DENIED') {
      msg += 'Usá una API key (no OAuth). En Credenciales creá una "Clave de API", habilitá Maps JavaScript API y Places API, y si restringís por referrer agregá esta URL.';
    } else if (statusStr === 'OVER_QUERY_LIMIT') {
      msg += 'Superaste el límite de la API. Revisá la facturación en Google Cloud.';
    } else if (statusStr === 'INVALID_REQUEST') {
      msg += 'La solicitud no es válida. Revisá la consola del navegador (F12) para más detalle.';
    } else {
      msg += 'Revisá que la API key esté bien en js/config.js y que Maps JavaScript API y Places API estén habilitadas en Google Cloud.';
    }
    return msg;
  }

  function requestLocation() {
    UI.setLocationMessage('Permití el acceso a tu ubicación para buscar cerca tuyo.');
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
        UI.setLocationStatus('');
        UI.setSearchEnabled(true);
        UI.setBarrioWrapVisible(true);
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
          UI.setLocationStatus('');
          UI.setSearchEnabled(true);
          UI.setBarrioWrapVisible(true);
        } else {
          UI.setLocationStatus('No encontramos esa ciudad. Probá de nuevo.');
        }
      });
    };
  }

  function runSearch() {
    var searchInput = UI.get('searchInput');
    var rawQuery = searchInput ? searchInput.value : '';
    var result = Sanitize.validateSearchQuery(rawQuery);
    if (!result.valid) {
      if (result.error) UI.showError(result.error);
      return;
    }
    if (!hasSearchCoords()) {
      UI.showError('Necesitamos una ubicación para buscar. Permití la tuya, ingresá una ciudad o elegí un barrio.');
      return;
    }

    var query = result.value;
    var now = Date.now();
    var cooldown = CONFIG.SEARCH_COOLDOWN_MS || 0;
    if (cooldown > 0 && (now - lastSearchTime) < cooldown) {
      return;
    }
    lastSearchTime = now;

    UI.hideStates();
    UI.hideResultsHeader();
    UI.showSkeleton(true);

    var searchQueryResto = 'restaurantes bares cafeterías lugares para comer near ' + searchLat + ',' + searchLng;

    MapsApi.textSearch(
      { query: searchQueryResto, lat: searchLat, lng: searchLng },
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

        SearchLogic.processResults({
          query: query,
          results: results,
          lat: searchLat,
          lng: searchLng
        }).then(function (data) {
          UI.showSkeleton(false);
          var places = data.places;
          var avgPrice = data.avgPrice;

          if (places.length === 0) {
            UI.showEmpty();
            return;
          }

          var dollarStr = avgPrice != null ? '$'.repeat(Math.round(avgPrice)) : '—';
          UI.showResultsHeader(places.length, query, dollarStr);

          var queryWords = Sanitize.getQueryWords(query);
          var cards = [];
          places.forEach(function (place, index) {
            cards.push(SearchLogic.buildCard(place, query, queryWords, avgPrice, index));
          });
          UI.renderCards(cards);
          UI.scrollToResults();
        }).catch(function () {
          UI.showSkeleton(false);
          UI.showError('Error al cargar los detalles de los lugares.');
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
        return;
      }
      var address = value + ', Argentina';
      MapsApi.geocode(address, function (results, status) {
        if (status === 'OK' && results && results[0]) {
          var loc = results[0].geometry.location;
          setSearchCenter(loc.lat(), loc.lng());
        }
      });
    });
  }

  function bindEvents() {
    var searchBtn = UI.get('searchBtn');
    var searchInput = UI.get('searchInput');
    var retryBtn = UI.get('retryBtn');
    var debounceMs = CONFIG.DEBOUNCE_MS || 400;

    bindBarrioSelect();
    if (searchBtn) searchBtn.addEventListener('click', runSearch);
    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') runSearch();
      });
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runSearch, debounceMs);
      });
    }
    if (retryBtn) retryBtn.addEventListener('click', runSearch);
  }

  function initMap() {
    if (!MapsApi.initServices()) {
      UI.showError('No se pudo inicializar la API de mapas.');
      return;
    }
    requestLocation();
    bindEvents();
  }

  function bootstrap() {
    var refs = {
      searchInput: document.getElementById('searchInput'),
      searchBtn: document.getElementById('searchBtn'),
      barrioSelect: document.getElementById('barrioSelect'),
      barrioWrap: document.getElementById('barrioWrap'),
      locationSection: document.getElementById('locationSection'),
      locationMessage: document.getElementById('locationMessage'),
      locationStatus: document.getElementById('locationStatus'),
      fallbackRow: document.getElementById('fallbackRow'),
      cityInput: document.getElementById('cityInput'),
      citySearchBtn: document.getElementById('citySearchBtn'),
      resultsHeader: document.getElementById('resultsHeader'),
      resultsTitle: document.getElementById('resultsTitle'),
      priceSummary: document.getElementById('priceSummary'),
      skeletonWrap: document.getElementById('skeletonWrap'),
      resultsSection: document.getElementById('resultsSection'),
      resultsGrid: document.getElementById('resultsGrid'),
      emptyState: document.getElementById('emptyState'),
      errorState: document.getElementById('errorState'),
      errorMessage: document.getElementById('errorMessage'),
      retryBtn: document.getElementById('retryBtn')
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
