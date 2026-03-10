/**
 * UI: referencias a elementos, mostrar/ocultar estados, mensajes, resultados.
 * Usa textContent para mensajes de usuario (OWASP: evitar inyección).
 */

(function (global) {
  'use strict';

  var elements = {};

  function init(refs) {
    elements = refs || {};
  }

  function get(id) {
    return elements[id] || document.getElementById(id);
  }

  function hideStates() {
    var resultsSection = get('resultsSection');
    var emptyState = get('emptyState');
    var errorState = get('errorState');
    if (resultsSection) resultsSection.classList.remove('visible');
    if (emptyState) emptyState.classList.remove('visible');
    if (errorState) errorState.classList.remove('visible');
  }

  function showEmpty() {
    hideStates();
    var emptyState = get('emptyState');
    if (emptyState) emptyState.classList.add('visible');
  }

  function showError(msg) {
    hideStates();
    var errorMessage = get('errorMessage');
    var errorState = get('errorState');
    if (errorMessage) errorMessage.textContent = msg;
    if (errorState) errorState.classList.add('visible');
  }

  function showSkeleton(show) {
    var skeletonWrap = get('skeletonWrap');
    if (!skeletonWrap) return;
    if (show) skeletonWrap.classList.add('visible');
    else skeletonWrap.classList.remove('visible');
  }

  function showResultsHeader(count, query, avgPriceStr) {
    var resultsHeader = get('resultsHeader');
    var resultsTitle = get('resultsTitle');
    var priceSummary = get('priceSummary');
    if (resultsHeader) resultsHeader.style.display = 'block';
    if (resultsTitle) {
      var plural = count !== 1 ? 'es' : '';
      var pluralS = count !== 1 ? 's' : '';
      resultsTitle.textContent = count + ' lugar' + plural + ' encontrado' + pluralS + ' para "' + query + '"';
    }
    if (priceSummary) priceSummary.textContent = 'Precio promedio del producto en la zona: ' + avgPriceStr;
  }

  function hideResultsHeader() {
    var resultsHeader = get('resultsHeader');
    if (resultsHeader) resultsHeader.style.display = 'none';
  }

  function renderCards(cards) {
    var resultsGrid = get('resultsGrid');
    var resultsSection = get('resultsSection');
    var emptyState = get('emptyState');
    var errorState = get('errorState');
    if (!resultsGrid) return;
    resultsGrid.innerHTML = '';
    cards.forEach(function (card) {
      resultsGrid.appendChild(card);
    });
    if (resultsSection) resultsSection.classList.add('visible');
    if (emptyState) emptyState.classList.remove('visible');
    if (errorState) errorState.classList.remove('visible');
  }

  function scrollToResults() {
    var resultsSection = get('resultsSection');
    if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setLocationMessage(text) {
    var el = get('locationMessage');
    if (el) el.textContent = text;
  }

  function setLocationStatus(text) {
    var el = get('locationStatus');
    if (el) el.textContent = text;
  }

  function setFallbackVisible(visible) {
    var fallbackRow = get('fallbackRow');
    if (fallbackRow) fallbackRow.style.display = visible ? 'flex' : 'none';
  }

  function setLocationSectionHidden(hidden) {
    var locationSection = get('locationSection');
    if (locationSection) {
      if (hidden) locationSection.classList.add('hidden');
      else locationSection.classList.remove('hidden');
    }
  }

  function setSearchEnabled(enabled) {
    var searchBtn = get('searchBtn');
    if (searchBtn) searchBtn.disabled = !enabled;
  }

  function setBarrioWrapVisible(visible) {
    var barrioWrap = get('barrioWrap');
    if (barrioWrap) barrioWrap.style.display = visible ? 'flex' : 'none';
  }

  global.UI = {
    init: init,
    get: get,
    hideStates: hideStates,
    showEmpty: showEmpty,
    showError: showError,
    showSkeleton: showSkeleton,
    showResultsHeader: showResultsHeader,
    hideResultsHeader: hideResultsHeader,
    renderCards: renderCards,
    scrollToResults: scrollToResults,
    setLocationMessage: setLocationMessage,
    setLocationStatus: setLocationStatus,
    setFallbackVisible: setFallbackVisible,
    setLocationSectionHidden: setLocationSectionHidden,
    setSearchEnabled: setSearchEnabled,
    setBarrioWrapVisible: setBarrioWrapVisible
  };
})(typeof window !== 'undefined' ? window : this);
