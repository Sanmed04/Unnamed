/**
 * Carga de la API de Google Maps/Places y wrappers de uso.
 * La key se inyecta de forma segura desde config (sin hardcodear en URLs en el repo).
 */

(function (global) {
  'use strict';

  let map = null;
  let placesService = null;
  let geocoder = null;
  let markers = [];

  function getPlacesService() {
    return placesService;
  }

  function getGeocoder() {
    return geocoder;
  }

  function getMap() {
    return map;
  }

  /**
   * Inicializa Maps y Places. Si se pasa mapContainer (HTMLElement), el mapa se renderiza ahí; si no, en un div oculto.
   * Debe llamarse cuando la API ya está cargada (callback).
   */
  function initServices(mapContainer) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      return false;
    }
    var div = mapContainer && mapContainer.appendChild ? mapContainer : document.createElement('div');
    div.style.minHeight = mapContainer ? '100%' : '0';
    map = new google.maps.Map(div, {
      center: { lat: -34.6, lng: -58.4 },
      zoom: 14
    });
    placesService = new google.maps.places.PlacesService(map);
    geocoder = new google.maps.Geocoder();
    return true;
  }

  /**
   * Búsqueda de negocios cercanos. type opcional (por defecto 'establishment'). Hasta 60 por tipo con paginación.
   */
  function nearbySearch(options, callback) {
    var svc = getPlacesService();
    if (!svc) {
      callback(null, 'SERVICE_UNAVAILABLE');
      return;
    }
    var lat = options.lat;
    var lng = options.lng;
    var radius = options.radius || 2500;
    var location = new google.maps.LatLng(lat, lng);
    var type = options.type || 'establishment';
    var allResults = [];
    var request = { location: location, radius: radius, type: type };

    svc.nearbySearch(request, function pageCb(results, status, pagination) {
      if (status !== google.maps.places.PlacesServiceStatus.OK) {
        callback(allResults.length ? allResults : null, status);
        return;
      }
      if (results && results.length) allResults = allResults.concat(results);
      if (pagination && pagination.hasNextPage && allResults.length < 60) {
        pagination.nextPage();
      } else {
        callback(allResults, status);
      }
    });
  }

  /**
   * Varias búsquedas por tipo y se fusionan por place_id para obtener más resultados que pasen el filtro.
   * @param {{ lat: number, lng: number, radius?: number, types?: string[], maxTotal?: number }}
   * @param {function} callback(results, status)
   */
  function nearbySearchMultipleTypes(options, callback) {
    var types = options.types || ['restaurant', 'cafe', 'store', 'bar', 'gym'];
    var maxTotal = options.maxTotal || 100;
    var lat = options.lat;
    var lng = options.lng;
    var radius = options.radius || 2500;
    var seen = {};
    var merged = [];
    var pending = types.length;
    var lastStatus = null;

    function onBatch(results, status) {
      lastStatus = status;
      if (results && results.length) {
        results.forEach(function (p) {
          if (p.place_id && !seen[p.place_id]) {
            seen[p.place_id] = true;
            merged.push(p);
          }
        });
      }
      pending--;
      if (pending === 0) {
        var out = merged.slice(0, maxTotal);
        callback(out.length ? out : null, lastStatus);
      }
    }

    types.forEach(function (type) {
      nearbySearch({ lat: lat, lng: lng, radius: radius, type: type }, onBatch);
    });
  }

  function clearMarkers() {
    markers.forEach(function (m) { m.setMap(null); });
    markers = [];
  }

  /**
   * Añade un marcador en el mapa. Si options.isPosibleCliente es true, usa icono azul para distinguirlo.
   */
  function addMarker(place, onClick, options) {
    var m = map;
    if (!m || !place.geometry || !place.geometry.location) return null;
    var isPosible = options && options.isPosibleCliente === true;
    var markerOpts = {
      map: m,
      position: place.geometry.location,
      title: place.name || ''
    };
    if (isPosible) {
      markerOpts.icon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#1565C0',
        fillOpacity: 1,
        strokeColor: '#0D47A1',
        strokeWeight: 2
      };
    }
    var marker = new google.maps.Marker(markerOpts);
    if (typeof onClick === 'function') {
      marker.addListener('click', function () { onClick(place); });
    }
    markers.push(marker);
    return marker;
  }

  function setMapCenter(lat, lng) {
    if (map) map.setCenter({ lat: lat, lng: lng });
  }

  function fitMapBounds(places) {
    if (!map || !places || !places.length) return;
    var bounds = new google.maps.LatLngBounds();
    places.forEach(function (p) {
      if (p.geometry && p.geometry.location) bounds.extend(p.geometry.location);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
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
   * Búsqueda por texto (nombre, etc.). Opcionalmente sesgada a una ubicación.
   * @param {{ query: string, lat?: number, lng?: number }}
   * @param {function} callback(results, status)
   */
  function textSearch(options, callback) {
    const svc = getPlacesService();
    if (!svc) {
      callback(null, 'SERVICE_UNAVAILABLE');
      return;
    }
    const request = {
      query: options.query
    };
    if (options.lat != null && options.lng != null) {
      request.location = new google.maps.LatLng(options.lat, options.lng);
      request.radius = options.radius || 5000;
    }
    svc.textSearch(request, callback);
  }

  const DETAIL_FIELDS = ['name', 'vicinity', 'formatted_address', 'address_components', 'url', 'formatted_phone_number', 'international_phone_number', 'website', 'types', 'reviews', 'price_level', 'rating', 'user_ratings_total'];

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
    getMap: getMap,
    textSearch: textSearch,
    nearbySearch: nearbySearch,
    nearbySearchMultipleTypes: nearbySearchMultipleTypes,
    getPlaceDetails: getPlaceDetails,
    geocode: geocode,
    getPlacesService: getPlacesService,
    getGeocoder: getGeocoder,
    clearMarkers: clearMarkers,
    addMarker: addMarker,
    setMapCenter: setMapCenter,
    fitMapBounds: fitMapBounds
  };
})(typeof window !== 'undefined' ? window : this);
