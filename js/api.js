/**
 * Carga de la API de Google Maps/Places y wrappers de uso.
 * La key se inyecta de forma segura desde config (sin hardcodear en URLs en el repo).
 */

(function (global) {
  'use strict';

  let map = null;
  let placesService = null;
  let geocoder = null;

  function getPlacesService() {
    return placesService;
  }

  function getGeocoder() {
    return geocoder;
  }

  /**
   * Inicializa Maps y Places. Debe llamarse cuando la API ya está cargada (callback).
   */
  function initServices() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      return false;
    }
    map = new google.maps.Map(document.createElement('div'), {
      center: { lat: -34.6, lng: -58.4 },
      zoom: 12
    });
    placesService = new google.maps.places.PlacesService(map);
    geocoder = new google.maps.Geocoder();
    return true;
  }

  /**
   * Carga el script de la API con la key desde config.
   * Llama a callback cuando esté listo (nombre global initMap).
   */
  function loadMapsApi() {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      if (initServices()) {
        if (typeof global.initMap === 'function') global.initMap();
      }
      return;
    }
    const key = (global.CONFIG && global.CONFIG.GOOGLE_MAPS_API_KEY) || '';
    if (!key || key === 'YOUR_KEY_HERE' || key === 'PEGÁ_ACÁ_TU_API_KEY') {
      if (typeof global.onMapsApiError === 'function') {
        global.onMapsApiError('Configurá GOOGLE_MAPS_API_KEY en js/config.js con tu clave de API.');
      }
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&libraries=places&language=es&callback=initMap';
    script.async = true;
    script.defer = true;
    script.onerror = function () {
      if (typeof global.onMapsApiError === 'function') {
        global.onMapsApiError('No se pudo cargar la API de Google Maps.');
      }
    };
    document.head.appendChild(script);
  }

  /**
   * Búsqueda por texto cerca de una ubicación.
   * @param {{ query: string, lat: number, lng: number }}
   * @param {function} callback(results, status)
   */
  function textSearch(options, callback) {
    const svc = getPlacesService();
    if (!svc) {
      callback(null, 'SERVICE_UNAVAILABLE');
      return;
    }
    const request = {
      query: options.query,
      fields: ['place_id', 'name', 'vicinity', 'geometry', 'rating', 'user_ratings_total', 'price_level']
    };
    svc.textSearch(request, callback);
  }

  const DETAIL_FIELDS = ['name', 'vicinity', 'formatted_address', 'url', 'reviews', 'price_level', 'rating', 'user_ratings_total'];

  /**
   * Obtiene detalles de un lugar por place_id.
   * @param {string} placeId
   * @param {function} callback(detail, status)
   */
  function getPlaceDetails(placeId, callback) {
    const svc = getPlacesService();
    if (!svc) {
      callback(null, 'SERVICE_UNAVAILABLE');
      return;
    }
    svc.getDetails(
      { placeId: placeId, fields: DETAIL_FIELDS },
      callback
    );
  }

  /**
   * Geocodifica una dirección (ej. ciudad en Argentina).
   * @param {string} address
   * @param {function} callback(results, status)
   */
  function geocode(address, callback) {
    const gc = getGeocoder();
    if (!gc) {
      callback(null, 'UNAVAILABLE');
      return;
    }
    gc.geocode({ address: address }, callback);
  }

  global.MapsApi = {
    load: loadMapsApi,
    initServices: initServices,
    textSearch: textSearch,
    getPlaceDetails: getPlaceDetails,
    geocode: geocode,
    getPlacesService: getPlacesService,
    getGeocoder: getGeocoder
  };
})(typeof window !== 'undefined' ? window : this);
