/**
 * Lógica de búsqueda: filtrado por menciones, scoring, badges de precio y construcción de tarjetas.
 * Usa Sanitize para todo output (OWASP).
 */

(function (global) {
  'use strict';

  const Sanitize = global.Sanitize;
  const MapsApi = global.MapsApi;

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
      console.log('[¿Dónde Está?] Búsqueda: "' + query + '" → palabras normalizadas:', queryWords);
      console.log('[¿Dónde Está?] Lugares obtenidos del texto "restaurantes bares..." en la zona:', results.length);
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
        console.log('[¿Dónde Está?] Detalles obtenidos correctamente:', valid.length, 'de', details.length);
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
        console.log('[¿Dónde Está?] Lugares que pasan el filtro (reseña menciona la búsqueda):', placesWithMentions.length);
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
    card.innerHTML =
      '<div class="place-name">📍 ' + Sanitize.escapeHtml(place.name) + '</div>' +
      '<div class="address">' + Sanitize.escapeHtml(place.vicinity) + '</div>' +
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
    processResults: processResults,
    buildCard: buildCard
  };
})(typeof window !== 'undefined' ? window : this);
