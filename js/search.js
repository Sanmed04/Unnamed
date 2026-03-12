/**
 * Lógica de búsqueda: negocios cercanos (todos), orden por distancia, listado y panel detalle.
 * Usa Sanitize para todo output (OWASP).
 */

(function (global) {
  'use strict';

  const Sanitize = global.Sanitize;
  const MapsApi = global.MapsApi;

  /** Tipos permitidos por categoría (Places API). "all" = unión de todos. */
  var CATEGORY_TYPES = {
    all: null,
    comida: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_delivery', 'meal_takeaway', 'food', 'food_court', 'meal_takeaway', 'liquor_store'],
    compras: ['store', 'supermarket', 'grocery_store', 'convenience_store', 'clothing_store', 'department_store', 'electronics_store', 'furniture_store', 'home_goods_store', 'jewelry_store', 'pet_store', 'book_store', 'hardware_store', 'shoe_store', 'gift_shop', 'market', 'florist', 'bicycle_store', 'cell_phone_store'],
    servicios: ['lawyer', 'real_estate_agency', 'travel_agency', 'insurance_agency', 'electrician', 'plumber', 'locksmith', 'laundry', 'hair_care', 'beauty_salon', 'barber_shop', 'accounting', 'funeral_home', 'moving_company', 'storage', 'veterinary_care', 'spa', 'beautician', 'florist', 'tailor', 'courier_service', 'cemetery'],
    salud: ['pharmacy', 'doctor', 'dentist', 'physiotherapist', 'health', 'medical_clinic', 'dental_clinic', 'chiropractor', 'drugstore'],
    alojamiento: ['hotel', 'motel', 'campground', 'guest_house', 'hostel', 'resort_hotel', 'bed_and_breakfast', 'inn'],
    automotor: ['car_wash', 'car_repair'],
    gym: ['gym', 'fitness_center']
  };

  var CATEGORY_LABELS = {
    all: 'Todos los tipos',
    comida: 'Comida y bebida',
    compras: 'Compras',
    servicios: 'Servicios',
    salud: 'Salud',
    alojamiento: 'Alojamiento',
    automotor: 'Automotor (lavado y reparación)',
    gym: 'Gimnasios'
  };

  function getCategoryFilters() {
    return { ids: Object.keys(CATEGORY_LABELS), labels: CATEGORY_LABELS };
  }

  function getAllowedTypesForCategory(categoryId) {
    if (categoryId === 'all') {
      var set = {};
      Object.keys(CATEGORY_TYPES).forEach(function (k) {
        if (k !== 'all' && CATEGORY_TYPES[k]) CATEGORY_TYPES[k].forEach(function (t) { set[t] = true; });
      });
      return Object.keys(set);
    }
    return CATEGORY_TYPES[categoryId] || [];
  }

  function placeMatchesCategory(place, categoryId) {
    var allowed = getAllowedTypesForCategory(categoryId);
    if (!allowed.length) return true;
    var types = (place.types || []).slice();
    if (types.length === 0) return true;
    return types.some(function (t) { return allowed.indexOf(t) !== -1; });
  }

  function filterPlacesByCategory(places, categoryId) {
    if (!categoryId || categoryId === 'all') return places;
    return places.filter(function (p) { return placeMatchesCategory(p, categoryId); });
  }

  /** Subcategorías (tipos) para una categoría. Devuelve [{ value, label }] para el select. */
  function getSubcategoriesForCategory(categoryId) {
    if (!categoryId || categoryId === 'all') return [];
    var types = CATEGORY_TYPES[categoryId];
    if (!types || !types.length) return [];
    var out = [];
    var seen = {};
    types.forEach(function (t) {
      if (seen[t]) return;
      seen[t] = true;
      out.push({ value: t, label: TYPE_LABELS[t] || t.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) });
    });
    return out;
  }

  function filterPlacesBySubcategory(places, subcategoryType) {
    if (!subcategoryType || subcategoryType === 'all') return places;
    return places.filter(function (p) {
      var types = p.types || [];
      return types.indexOf(subcategoryType) !== -1;
    });
  }

  function filterPlacesByPosiblesClientes(places, posiblesPlaceIds) {
    if (!posiblesPlaceIds || !posiblesPlaceIds.length) return places;
    var set = {};
    posiblesPlaceIds.forEach(function (id) { set[id] = true; });
    return places.filter(function (p) { return set[p.place_id]; });
  }

  function filterPlacesBySinWeb(places) {
    return places.filter(function (p) {
      var w = (p.website || '').trim();
      return w.length === 0;
    });
  }

  /** Etiquetas en español para tipos de la API (primer tipo específico que matchee). */
  var TYPE_LABELS = {
    restaurant: 'Restaurante',
    cafe: 'Café',
    bar: 'Bar',
    bakery: 'Panadería',
    meal_delivery: 'Delivery',
    meal_takeaway: 'Comida para llevar',
    food: 'Comida y bebida',
    food_court: 'Food court',
    store: 'Tienda',
    supermarket: 'Supermercado',
    shopping_mall: 'Shopping',
    grocery_store: 'Almacén',
    convenience_store: 'Kiosco',
    clothing_store: 'Indumentaria',
    pharmacy: 'Farmacia',
    hospital: 'Hospital',
    doctor: 'Médico',
    dentist: 'Dentista',
    veterinary_care: 'Veterinaria',
    gym: 'Gimnasio',
    fitness_center: 'Gimnasio',
    hotel: 'Hotel',
    lodging: 'Alojamiento',
    bank: 'Banco',
    gas_station: 'Estación de servicio',
    car_wash: 'Lavado de autos',
    car_repair: 'Taller mecánico',
    beauty_salon: 'Salón de belleza',
    hair_care: 'Peluquería',
    barber_shop: 'Barbería',
    laundry: 'Lavandería',
    travel_agency: 'Agencia de viajes',
    real_estate_agency: 'Inmobiliaria',
    lawyer: 'Abogado',
    insurance_agency: 'Aseguradora',
    florist: 'Florería',
    bookstore: 'Librería',
    book_store: 'Librería',
    electronics_store: 'Electrónica',
    furniture_store: 'Mueblería',
    pet_store: 'Pet shop',
    museum: 'Museo',
    movie_theater: 'Cine',
    park: 'Parque',
    establishment: 'Negocio',
    point_of_interest: 'Punto de interés'
  };

  var GENERIC_TYPES = { establishment: true, point_of_interest: true };

  function getPlaceTypeLabel(place) {
    var types = place.types || [];
    var genericLabel = null;
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      if (!TYPE_LABELS[t]) continue;
      if (GENERIC_TYPES[t]) {
        if (!genericLabel) genericLabel = TYPE_LABELS[t];
        continue;
      }
      return TYPE_LABELS[t];
    }
    if (genericLabel) return genericLabel;
    if (types[0]) {
      return types[0].replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    return 'Negocio';
  }

  /**
   * Genera un mensaje de oferta de servicio (páginas web) personalizado según el tipo de negocio.
   * Objetivo: vender nuestro servicio explicando cómo una web puede ayudar a ese negocio.
   */
  function generatePitchMessage(place) {
    var name = (place.name || '').trim() || 'el negocio';
    var typeLabel = getPlaceTypeLabel(place);
    var hasWeb = !!(place.website && place.website.trim());
    var types = place.types || [];
    var firstType = types[0] || '';

    var intro = 'Hola';
    if (name && name !== 'Sin nombre') intro += ', ' + name;
    intro += '. ';

    var byType = '';
    if (firstType === 'restaurant' || firstType === 'cafe' || firstType === 'bar' || firstType === 'food' || firstType === 'bakery' || firstType === 'meal_delivery' || firstType === 'meal_takeaway') {
      byType = 'Una página web permite que más gente encuentre tu ' + (typeLabel.toLowerCase()) + ', vea la carta o el menú, los horarios y hasta reserve o pida delivery. ';
    } else if (firstType === 'store' || firstType === 'supermarket' || firstType === 'clothing_store' || firstType === 'grocery_store' || firstType === 'convenience_store' || firstType === 'florist' || firstType === 'book_store' || firstType === 'pet_store' || firstType === 'furniture_store' || firstType === 'electronics_store') {
      byType = 'Con un sitio web tu ' + (typeLabel.toLowerCase()) + ' puede mostrarse en Google, mostrar productos, horarios y promociones, y llegar a más clientes de la zona. ';
    } else if (firstType === 'gym' || firstType === 'fitness_center') {
      byType = 'Una web para tu gimnasio ayuda a mostrar clases, horarios, planes y a que nuevos socios se inscriban o consulten. ';
    } else if (firstType === 'hotel' || firstType === 'lodging') {
      byType = 'Un sitio web profesional hace que tu alojamiento se vea confiable, muestre habitaciones y precios, y facilite reservas. ';
    } else if (firstType === 'beauty_salon' || firstType === 'hair_care' || firstType === 'barber_shop') {
      byType = 'Una página web para tu salón o peluquería permite mostrar servicios, precios y que los clientes reserven turno. ';
    } else if (firstType === 'car_wash' || firstType === 'car_repair') {
      byType = 'Una web para tu negocio automotor ayuda a que te encuentren en Google, vean servicios y precios y te contacten fácil. ';
    } else if (firstType === 'pharmacy' || firstType === 'doctor' || firstType === 'dentist' || firstType === 'veterinary_care') {
      byType = 'Un sitio web da credibilidad y permite que los pacientes vean horarios, servicios y formas de contacto. ';
    } else {
      byType = 'Una página web profesional ayuda a que más clientes te encuentren en Google, conozcan tu negocio y te contacten. ';
    }

    var offer = 'Nos dedicamos a crear páginas web para negocios como el tuyo: modernas, rápidas y pensadas para sumar clientes. ';
    if (hasWeb) {
      offer = 'Si querés mejorar tu presencia online o renovar tu sitio, podemos ayudarte. ';
    }
    var cta = '¿Te gustaría que te contemos cómo podemos ayudarte?';

    return intro + byType + offer + cta;
  }

  /** Si el website es Instagram, devuelve la URL segura; si no, null. */
  function getInstagramUrl(place) {
    var w = (place.website || '').trim().toLowerCase();
    if (!w) return null;
    if (w.indexOf('instagram.com') !== -1) return Sanitize.sanitizeUrl(place.website.trim());
    return null;
  }

  function isTiendanubeUrl(url) {
    return (url || '').toLowerCase().indexOf('mitiendanube.com') !== -1;
  }

  /** Icono SVG Instagram (logo tipo cámara). */
  var INSTAGRAM_ICON_SVG = '<svg class="detail-site-icon detail-icon-instagram" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>';

  /** Badge Tiendanube (texto con clase para estilizar). */
  var TIENDANUBE_BADGE = '<span class="detail-tiendanube-badge">Tiendanube</span>';

  /** Distancia aproximada en metros entre dos puntos (fórmula de Haversine). */
  function distanceMeters(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(m) {
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  /** Extrae la zona (barrio o localidad) desde address_components del Place. */
  function getZoneFromAddressComponents(components) {
    if (!components || !components.length) return '';
    var zone = '';
    var locality = '';
    for (var i = 0; i < components.length; i++) {
      var c = components[i];
      var types = c.types || [];
      if (types.indexOf('sublocality') !== -1 || types.indexOf('sublocality_level_1') !== -1) {
        zone = c.long_name || c.short_name || '';
        break;
      }
      if (types.indexOf('locality') !== -1) locality = c.long_name || c.short_name || '';
    }
    return zone || locality || '';
  }

  /**
   * Procesa resultados de Nearby Search: pide detalles de cada uno, ordena de más cercano a más lejano.
   * @param {{ results: Array, lat: number, lng: number }}
   * @returns {Promise<{ places: Array }>} — cada place tiene place_id, name, vicinity, url, phone, website, geometry, distanceMeters
   */
  function processNearbyResults(options) {
    var results = (options.results || []).slice(0, 100);
    var userLat = options.lat;
    var userLng = options.lng;

    var detailPromises = results.map(function (place) {
      return new Promise(function (resolve) {
        MapsApi.getPlaceDetails(place.place_id, function (detail, status) {
          if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
            var loc = place.geometry && place.geometry.location;
            var lat = loc ? (typeof loc.lat === 'function' ? loc.lat() : loc.lat) : userLat;
            var lng = loc ? (typeof loc.lng === 'function' ? loc.lng() : loc.lng) : userLng;
            var dist = distanceMeters(userLat, userLng, lat, lng);
            var websiteRaw = (detail.website || detail.website_uri || '').trim();
            var zone = getZoneFromAddressComponents(detail.address_components);
            resolve({
              place_id: place.place_id,
              name: detail.name || place.name || '',
              vicinity: detail.vicinity || detail.formatted_address || place.vicinity || 'Dirección no disponible',
              zone: zone,
              url: detail.url || place.url || '',
              formatted_phone_number: (detail.formatted_phone_number || '').trim(),
              website: websiteRaw,
              types: detail.types || place.types || [],
              geometry: place.geometry,
              rating: detail.rating,
              user_ratings_total: detail.user_ratings_total || 0,
              distanceMeters: dist
            });
          } else {
            resolve(null);
          }
        });
      });
    });

    return Promise.all(detailPromises).then(function (details) {
      var valid = details.filter(Boolean);
      valid.sort(function (a, b) { return a.distanceMeters - b.distanceMeters; });
      return { places: valid };
    });
  }

  /**
   * Clasificación por cantidad de reseñas: muy buen candidato (&lt;200), posible (&lt;1000), mal candidato (≥1000).
   * @returns {{ label: string, className: string }}
   */
  function getCandidateByReviews(totalReviews) {
    var n = totalReviews != null ? totalReviews : 0;
    if (n < 200) return { label: 'Muy buen candidato', className: 'list-card-candidate list-card-candidate-good' };
    if (n < 1000) return { label: 'Posible candidato', className: 'list-card-candidate list-card-candidate-possible' };
    return { label: 'Mal candidato', className: 'list-card-candidate list-card-candidate-bad' };
  }

  /**
   * Construye una fila de la lista (nombre + distancia + candidato). Al hacer clic se llama onSelect(place).
   */
  function buildListCard(place, index, onSelect) {
    var row = document.createElement('div');
    row.className = 'list-card';
    row.setAttribute('data-place-id', place.place_id);
    row.style.animationDelay = (index * 0.04) + 's';
    var distStr = formatDistance(place.distanceMeters);
    var rating = place.rating != null ? place.rating.toFixed(1) : '—';
    var totalReviews = place.user_ratings_total != null ? place.user_ratings_total : 0;
    var reviewsStr = totalReviews === 0 ? 'Sin reseñas' : totalReviews + ' reseña' + (totalReviews !== 1 ? 's' : '');
    var typeLabel = getPlaceTypeLabel(place);
    var candidate = getCandidateByReviews(totalReviews);
    var zoneHtml = (place.zone && place.zone.trim()) ? '<div class="list-card-zone">' + Sanitize.escapeHtml(place.zone) + '</div>' : '';
    var candidateHtml = '<span class="' + candidate.className + '">' + Sanitize.escapeHtml(candidate.label) + '</span>';
    row.innerHTML =
      '<div class="list-card-name">' + Sanitize.escapeHtml(place.name) + '</div>' +
      '<div class="list-card-type">' + Sanitize.escapeHtml(typeLabel) + '</div>' +
      zoneHtml +
      '<div class="list-card-candidate-wrap">' + candidateHtml + '</div>' +
      '<div class="list-card-meta">' +
      '<span class="list-card-rating">⭐ ' + Sanitize.escapeHtml(rating) + '</span>' +
      '<span class="list-card-reviews">' + Sanitize.escapeHtml(reviewsStr) + '</span>' +
      '<span class="list-card-distance">' + Sanitize.escapeHtml(distStr) + '</span>' +
      '</div>';
    row.addEventListener('click', function () { onSelect(place); });
    return row;
  }

  /**
   * Genera el HTML del panel de detalle: teléfono, sitio web, mensaje para el cliente, botón marcar/quitar posible cliente, nota.
   * currentCustomMessage: mensaje personalizado guardado (si ya es posible cliente) o null.
   * defaultPitch: mensaje generado por tipo de negocio para prellenar al marcar como posible cliente.
   */
  function buildDetailPanelContent(place, isPosibleCliente, currentNote, currentCustomMessage, defaultPitch, onMarkPosibleCliente, onUnmarkPosibleCliente, onSaveNote, onSaveCustomMessage) {
    var phoneHtml = (place.formatted_phone_number)
      ? (function () {
          var raw = place.formatted_phone_number;
          var telHref = raw.replace(/[^\d+\-\s]/g, '').replace(/\s/g, '');
          return telHref ? '<p class="detail-line"><a href="tel:' + Sanitize.escapeHtml(telHref) + '">📞 ' + Sanitize.escapeHtml(raw) + '</a></p>' : '<p class="detail-line">📞 No tiene teléfono</p>';
        })()
      : '<p class="detail-line">📞 No tiene teléfono</p>';

    var typeLabel = getPlaceTypeLabel(place);
    var safeWeb = place.website ? Sanitize.sanitizeUrl(place.website) : '';
    var websiteBlock;
    if (safeWeb && safeWeb !== '#') {
      var w = (place.website || '').toLowerCase();
      var linkContent;
      if (w.indexOf('instagram.com') !== -1) {
        linkContent = INSTAGRAM_ICON_SVG + ' <span class="detail-link-text">Instagram</span>';
      } else if (isTiendanubeUrl(place.website)) {
        linkContent = '🌐 ' + TIENDANUBE_BADGE + ' <span class="detail-link-text">Sitio web</span>';
      } else {
        linkContent = '🌐 <span class="detail-link-text">Sitio web</span>';
      }
      websiteBlock = '<p class="detail-line detail-website-line"><a class="detail-website-link" href="' + Sanitize.escapeHtml(safeWeb) + '" target="_blank" rel="noopener noreferrer">' + linkContent + '</a></p>';
    } else {
      websiteBlock = '<p class="detail-line detail-no-web">No tiene sitio web</p>';
    }

    var messageBlock = '';
    if (isPosibleCliente) {
      messageBlock = '<div class="detail-message-wrap"><label for="detailCustomMessageInput" class="detail-note-label">Mensaje para el cliente</label>' +
        '<textarea id="detailCustomMessageInput" class="detail-note-input detail-message-input" rows="5" placeholder="Mensaje de oferta de tu servicio..." maxlength="2000">' + Sanitize.escapeHtml(currentCustomMessage || '') + '</textarea>' +
        '<button type="button" class="btn-guardar-nota" id="btnSaveCustomMessage">Guardar mensaje</button></div>';
    } else {
      messageBlock = '<div class="detail-message-wrap"><label for="detailCustomMessageInput" class="detail-note-label">Mensaje para el cliente</label>' +
        '<textarea id="detailCustomMessageInput" class="detail-note-input detail-message-input" rows="5" placeholder="Mensaje de oferta de tu servicio..." maxlength="2000">' + Sanitize.escapeHtml(defaultPitch || '') + '</textarea>' +
        '<p class="detail-message-hint">Podés editarlo antes de guardar. Se usará para ofrecer tu servicio a este negocio.</p></div>';
    }

    var posibleBlock = '';
    if (isPosibleCliente) {
      posibleBlock = '<p class="detail-posible-label">✓ En tu lista de posibles clientes</p>' +
        '<button type="button" class="btn-quitar-posible" id="btnUnmarkPosibleCliente">Quitar de la lista</button>' +
        '<div class="detail-note-wrap"><label for="detailNoteInput" class="detail-note-label">Tu nota</label>' +
        '<textarea id="detailNoteInput" class="detail-note-input" rows="3" placeholder="Agregá una nota para este negocio..." maxlength="1000">' + Sanitize.escapeHtml(currentNote || '') + '</textarea>' +
        '<button type="button" class="btn-guardar-nota" id="btnSaveNote">Guardar nota</button></div>';
    } else {
      posibleBlock = '<button type="button" class="btn-posible-cliente" id="btnMarkPosibleCliente">Marcar como posible cliente</button>';
    }

    var safeUrl = Sanitize.sanitizeUrl(place.url);
    var rating = place.rating != null ? place.rating.toFixed(1) : '—';
    var totalReviews = place.user_ratings_total != null ? place.user_ratings_total : 0;
    var detailRatingHtml = '<p class="detail-rating">⭐ ' + Sanitize.escapeHtml(rating) + (totalReviews > 0 ? ' (' + totalReviews + ' reseña' + (totalReviews !== 1 ? 's' : '') + ')' : '') + '</p>';
    var zoneHtml = (place.zone && place.zone.trim()) ? '<p class="detail-zone">📍 ' + Sanitize.escapeHtml(place.zone) + '</p>' : '';
    return (
      '<h3 class="detail-name">' + Sanitize.escapeHtml(place.name) + '</h3>' +
      '<p class="detail-type">' + Sanitize.escapeHtml(typeLabel) + '</p>' +
      zoneHtml +
      detailRatingHtml +
      '<p class="detail-address">' + Sanitize.escapeHtml(place.vicinity) + '</p>' +
      '<div class="detail-description-wrap" id="detailDescriptionWrap"><p class="detail-description-loading">Generando descripción…</p></div>' +
      '<div class="detail-message-section">' +
      '<button type="button" class="btn-generar-mensaje" id="btnGenerarMensaje">✉️ Generar mensaje personalizado</button>' +
      '<div class="detail-message-wrap" id="detailMessageWrap" style="display:none;">' +
      '<label for="detailMessageInput" class="detail-message-label">Mensaje (podés editarlo)</label>' +
      '<textarea id="detailMessageInput" class="detail-message-input" rows="5" placeholder="El mensaje aparecerá acá…" maxlength="2000"></textarea>' +
      '<button type="button" class="btn-copiar-mensaje" id="btnCopiarMensaje">Copiar</button>' +
      '</div></div>' +
      phoneHtml +
      websiteBlock +
      '<div class="detail-posible-wrap">' + messageBlock + posibleBlock + '</div>' +
      '<a class="detail-maps-link" href="' + Sanitize.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">Ver en Google Maps</a>'
    );
  }

  /**
   * Procesa resultados de Text Search: pide detalles, filtra por menciones y ordena.
   * @param {{ query: string, results: Array, lat: number, lng: number }}
   * @returns {Promise<{ places: Array, avgPrice: number|null }>}
   */
  function processResults(options) {
    const query = options.query;
    const results = (options.results || []).slice(0, 45);
    const queryWords = Sanitize.getQueryWords(query).map(function (w) {
      return Sanitize.normalizeAccents(w).toLowerCase();
    });
    const debug = (global.CONFIG && global.CONFIG.DEBUG) || false;

    if (debug) {
      console.log('[Web Job Finder] Búsqueda: "' + query + '" → palabras normalizadas:', queryWords);
      console.log('[Web Job Finder] Lugares obtenidos del texto "restaurantes bares..." en la zona:', results.length);
    }

    const detailPromises = results.map(function (place) {
      return new Promise(function (resolve) {
        MapsApi.getPlaceDetails(place.place_id, function (detail, status) {
          if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
            resolve(detail);
          } else {
            resolve(null);
          }
        });
      });
    });

    return Promise.all(detailPromises).then(function (details) {
      const valid = details.filter(Boolean);
      const placesWithMentions = [];

      if (debug) {
        console.log('[Web Job Finder] Detalles obtenidos correctamente:', valid.length, 'de', details.length);
      }

      valid.forEach(function (place) {
        const reviews = place.reviews || [];
        const mentioning = reviews.filter(function (r) {
          var text = (r.text || '').toLowerCase();
          var textNorm = Sanitize.normalizeAccents(text);
          return queryWords.length > 0 && queryWords.every(function (word) {
            return textNorm.indexOf(word) !== -1;
          });
        });
        var nameNorm = Sanitize.normalizeAccents((place.name || '').toLowerCase());
        var nameMatch = queryWords.length > 0 && queryWords.every(function (word) {
          return nameNorm.indexOf(word) !== -1;
        });
        if (debug) {
          var reason = '';
          if (reviews.length === 0) reason = 'sin reseñas en la API';
          else if (mentioning.length === 0) {
            if (nameMatch) reason = 'coincide por nombre del lugar';
            else {
              var missing = queryWords.filter(function (w) {
                var found = reviews.some(function (r) {
                  return Sanitize.normalizeAccents((r.text || '').toLowerCase()).indexOf(w) !== -1;
                });
                return !found;
              });
              reason = 'ninguna reseña tiene todas las palabras (ej. faltan: ' + (missing.join(', ') || '—') + ')';
            }
          }
          console.log(
            '  ·', place.name,
            '| reseñas:', reviews.length,
            mentioning.length > 0 ? '| ✓ reseña' : (nameMatch ? '| ✓ nombre' : '| ✗ ' + reason)
          );
        }
        if (mentioning.length === 0 && !nameMatch) return;

        const totalMentions = mentioning.length;
        const positiveMentions = mentioning.filter(function (r) {
          return (r.rating || 0) >= 4;
        }).length;
        const mentionScore = totalMentions > 0 ? Math.round((positiveMentions / totalMentions) * 100) : null;

        placesWithMentions.push({
          name: place.name,
          vicinity: place.vicinity || place.formatted_address || 'Dirección no disponible',
          url: place.url || '',
          formatted_phone_number: place.formatted_phone_number || '',
          website: place.website || '',
          rating: place.rating,
          user_ratings_total: place.user_ratings_total || 0,
          price_level: place.price_level,
          reviews: place.reviews || [],
          mentioningReviews: mentioning,
          mentionScore: mentionScore,
          positiveMentions: positiveMentions,
          totalMentions: totalMentions,
          nameMatch: nameMatch && mentioning.length === 0
        });
      });

      placesWithMentions.sort(function (a, b) {
        var sa = a.mentionScore != null ? a.mentionScore : -1;
        var sb = b.mentionScore != null ? b.mentionScore : -1;
        return sb - sa;
      });

      if (debug) {
        console.log('[Web Job Finder] Lugares que pasan el filtro (reseña menciona la búsqueda):', placesWithMentions.length);
      }

      const priceLevels = placesWithMentions
        .map(function (p) { return p.price_level; })
        .filter(function (v) { return v != null && v >= 1 && v <= 4; });
      const avgPrice = priceLevels.length
        ? priceLevels.reduce(function (a, b) { return a + b; }, 0) / priceLevels.length
        : null;

      return { places: placesWithMentions, avgPrice: avgPrice };
    });
  }

  /**
   * Construye el DOM de una tarjeta de resultado (con escapeHtml y sanitizeUrl).
   * queryWords: array de palabras de la búsqueda para resaltar en reseñas.
   */
  function buildCard(place, query, queryWords, avgPrice, index) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = (index * 0.08) + 's';

    var priceBadge = '💲 Precio no disponible';
    var badgeClass = 'unknown';
    if (place.price_level != null && place.price_level >= 1 && place.price_level <= 4 && avgPrice != null) {
      if (place.price_level < avgPrice) {
        priceBadge = '🟢 Barato';
        badgeClass = 'cheap';
      } else if (place.price_level > avgPrice) {
        priceBadge = '🔴 Caro';
        badgeClass = 'expensive';
      } else {
        priceBadge = '🟡 Precio normal';
        badgeClass = 'normal';
      }
    }

    var stars = place.rating != null
      ? '★'.repeat(Math.round(place.rating)) + '☆'.repeat(5 - Math.round(place.rating))
      : '—';
    var reviewCount = place.user_ratings_total || 0;
    var mentionText = place.nameMatch
      ? 'Aparece en el nombre del lugar (la API solo devuelve hasta 5 reseñas por lugar)'
      : place.mentionScore + '% de menciones positivas (' + place.positiveMentions + '/' + place.totalMentions + ' reseñas)';

    var topReviews = place.mentioningReviews.length > 0
      ? place.mentioningReviews.slice(0, 3)
      : (place.reviews || []).slice(0, 3);
    var reviewsHtml = '';
    topReviews.forEach(function (r) {
      var dateStr = r.relative_time_description || '';
      var rStars = '★'.repeat(Math.round(r.rating || 0)) + '☆'.repeat(5 - Math.round(r.rating || 0));
      reviewsHtml +=
        '<div class="review-item">' +
        '<div class="review-author">' + Sanitize.escapeHtml(r.author_name || 'Anónimo') + '</div>' +
        '<div class="review-stars">' + rStars + '</div>' +
        '<div class="review-text">' + Sanitize.highlightWordsInText(r.text, queryWords) + '</div>' +
        '<div class="review-date">' + Sanitize.escapeHtml(dateStr) + '</div>' +
        '</div>';
    });

    var safeUrl = Sanitize.sanitizeUrl(place.url);
    var phoneHtml = (place.formatted_phone_number && place.formatted_phone_number.trim())
      ? (function () {
          var raw = place.formatted_phone_number;
          var telHref = raw.replace(/[^\d+\-\s]/g, '').replace(/\s/g, '');
          return telHref ? '<a class="place-phone" href="tel:' + Sanitize.escapeHtml(telHref) + '">📞 ' + Sanitize.escapeHtml(raw) + '</a>' : '';
        })()
      : '';
    var websiteHtml = (place.website && place.website.trim())
      ? (function () {
          var safeWeb = Sanitize.sanitizeUrl(place.website);
          return safeWeb ? '<a class="place-website" href="' + Sanitize.escapeHtml(safeWeb) + '" target="_blank" rel="noopener noreferrer">🌐 Sitio web</a>' : '';
        })()
      : '';
    var contactBlock = (phoneHtml || websiteHtml)
      ? '<div class="place-contact">' + phoneHtml + (phoneHtml && websiteHtml ? ' ' : '') + websiteHtml + '</div>'
      : '';
    card.innerHTML =
      '<div class="place-name">📍 ' + Sanitize.escapeHtml(place.name) + '</div>' +
      '<div class="address">' + Sanitize.escapeHtml(place.vicinity) + '</div>' +
      contactBlock +
      '<a class="maps-link" href="' + Sanitize.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">Ver en Google Maps</a>' +
      '<div class="rating-row">' +
      '<span class="stars">⭐ ' + stars + '</span>' +
      '<span>' + (place.rating != null ? place.rating.toFixed(1) : '—') + ' (' + reviewCount + ' reseñas)</span>' +
      '</div>' +
      '<div class="mention-score-wrap">' +
      '<div class="mention-score-text">💬 ' + Sanitize.escapeHtml(mentionText) + '</div>' +
      '<div class="mention-score-bar">' +
      '<div class="mention-score-fill" style="width:' + (place.mentionScore != null ? Math.min(100, Math.max(0, place.mentionScore)) : 0) + '%"></div>' +
      '</div>' +
      '</div>' +
      '<div class="reviews-list">' + reviewsHtml + '</div>' +
      '<span class="price-badge ' + Sanitize.escapeHtml(badgeClass) + '">' + Sanitize.escapeHtml(priceBadge) + '</span>';

    return card;
  }

  global.SearchLogic = {
    getCategoryFilters: getCategoryFilters,
    getAllowedTypesForCategory: getAllowedTypesForCategory,
    placeMatchesCategory: placeMatchesCategory,
    filterPlacesByCategory: filterPlacesByCategory,
    getSubcategoriesForCategory: getSubcategoriesForCategory,
    filterPlacesBySubcategory: filterPlacesBySubcategory,
    filterPlacesByPosiblesClientes: filterPlacesByPosiblesClientes,
    filterPlacesBySinWeb: filterPlacesBySinWeb,
    processResults: processResults,
    processNearbyResults: processNearbyResults,
    buildCard: buildCard,
    buildListCard: buildListCard,
    buildDetailPanelContent: buildDetailPanelContent,
    generatePitchMessage: generatePitchMessage,
    formatDistance: formatDistance
  };
})(typeof window !== 'undefined' ? window : this);
