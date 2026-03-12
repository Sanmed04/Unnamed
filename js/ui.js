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
    var listHeader = get('listHeader');
    if (resultsSection) resultsSection.classList.remove('visible');
    if (emptyState) emptyState.classList.remove('visible');
    if (errorState) errorState.classList.remove('visible');
    if (listHeader) listHeader.style.display = 'none';
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

  function setHeaderActionsVisible(visible) {
    var headerActions = get('headerActions');
    if (headerActions) headerActions.style.display = visible ? 'flex' : 'none';
  }

  function setLoadPlacesEnabled(enabled) {
    var btn = get('loadPlacesBtn');
    if (btn) btn.disabled = !enabled;
  }

  function showListHeader(count) {
    var listHeader = get('listHeader');
    var resultsTitle = get('resultsTitle');
    var listCount = get('listCount');
    if (listHeader) listHeader.style.display = 'block';
    if (resultsTitle) resultsTitle.textContent = 'Negocios (más cercano a más lejano)';
    if (listCount) listCount.textContent = count + ' negocio' + (count !== 1 ? 's' : '');
  }

  function renderListCards(cards) {
    var resultsList = get('resultsList');
    var resultsSection = get('resultsSection');
    var emptyState = get('emptyState');
    var errorState = get('errorState');
    if (!resultsList) return;
    resultsList.innerHTML = '';
    cards.forEach(function (card) { resultsList.appendChild(card); });
    if (resultsSection) resultsSection.classList.add('visible');
    if (emptyState) emptyState.classList.remove('visible');
    if (errorState) errorState.classList.remove('visible');
  }

  function showDetailPanel(html, onBindButtons) {
    var overlay = get('detailOverlay');
    var content = get('detailContent');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof onBindButtons === 'function') {
      setTimeout(onBindButtons, 0);
    }
  }

  function hideDetailPanel() {
    var overlay = get('detailOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function updatePosiblesClientes(list, onItemClick) {
    var wrap = get('posiblesList');
    var countEl = get('posiblesCount');
    if (countEl) countEl.textContent = String(list.length);
    if (!wrap) return;
    wrap.innerHTML = '';
    list.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'posible-item';
      li.textContent = item.name || item.place_id || 'Sin nombre';
      if (typeof onItemClick === 'function') {
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        li.addEventListener('click', function () { onItemClick(item); });
        li.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onItemClick(item);
          }
        });
      }
      wrap.appendChild(li);
    });
  }

  function setFilterRowVisible(visible) {
    var row = get('filterRow');
    if (row) row.style.display = visible ? 'flex' : 'none';
  }

  function getCategoryFilter() {
    var sel = get('categoryFilter');
    return sel ? (sel.value || 'all') : 'all';
  }

  function getSubcategoryFilter() {
    var sel = get('subcategoryFilter');
    return sel ? (sel.value || 'all') : 'all';
  }

  function setSubcategoryOptions(options) {
    var sel = get('subcategoryFilter');
    if (!sel) return;
    var current = sel.value || 'all';
    sel.innerHTML = '<option value="all">Todas</option>';
    (options || []).forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
    if (current === 'all' || options.some(function (o) { return o.value === current; })) {
      sel.value = current;
    } else {
      sel.value = 'all';
    }
  }

  function setSubcategoryFilterVisible(visible) {
    var wrap = get('subcategoryFilterWrap');
    if (wrap) wrap.style.display = visible ? 'inline-flex' : 'none';
  }

  function getOnlyPosiblesClientes() {
    var cb = get('filterPosiblesClientes');
    return cb ? cb.checked : false;
  }

  function getOnlySinWeb() {
    var cb = get('filterSinWeb');
    return cb ? cb.checked : false;
  }

  function getSortOrder() {
    var sel = get('sortOrder');
    return sel ? (sel.value || 'cercania') : 'cercania';
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
    renderListCards: renderListCards,
    scrollToResults: scrollToResults,
    setLocationMessage: setLocationMessage,
    setLocationStatus: setLocationStatus,
    setFallbackVisible: setFallbackVisible,
    setLocationSectionHidden: setLocationSectionHidden,
    setSearchEnabled: setSearchEnabled,
    setBarrioWrapVisible: setBarrioWrapVisible,
    setHeaderActionsVisible: setHeaderActionsVisible,
    setLoadPlacesEnabled: setLoadPlacesEnabled,
    showListHeader: showListHeader,
    showDetailPanel: showDetailPanel,
    hideDetailPanel: hideDetailPanel,
    updatePosiblesClientes: updatePosiblesClientes,
    setFilterRowVisible: setFilterRowVisible,
    getCategoryFilter: getCategoryFilter,
    getSubcategoryFilter: getSubcategoryFilter,
    setSubcategoryOptions: setSubcategoryOptions,
    setSubcategoryFilterVisible: setSubcategoryFilterVisible,
    getOnlyPosiblesClientes: getOnlyPosiblesClientes,
    getOnlySinWeb: getOnlySinWeb,
    getSortOrder: getSortOrder
  };
})(typeof window !== 'undefined' ? window : this);
