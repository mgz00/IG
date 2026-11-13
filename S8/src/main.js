import './style.css';
import { earthquakes, oldEarthquakes, volcanoes, tsunamis, meteorites, eruptionYears, formatYear, loadCatalog, readRecent, normalizeSearch } from './data.js';
import { createGlobe } from './globe.js';
import { eventFootprint, referenceDistance } from './footprint.js';

const element = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'viewer', 'view-mode', 'view-period', 'detail', 'error', 'search', 'results', 'search-status',
  'show-quakes', 'show-volcanoes', 'show-tsunamis', 'show-plates', 'quake-count', 'volcano-count', 'tsunami-count',
  'show-meteorites', 'meteorite-count',
  'historic', 'recent', 'magnitude', 'mag-value', 'mag-min', 'recent-options', 'recent-status',
  'refresh', 'timeline', 'year', 'year-value', 'play', 'all-years', 'zoom-in', 'zoom-out', 'reset-view',
  'orbit', 'first-year', 'year-entry', 'orbit-speed', 'orbit-speed-value', 'playback-speed',
].map((id) => [id, element(id)]));

const lastYear = Number(ui['year-entry'].max);
let firstYear = -2150;
const sliderEnd = Number(ui.year.max);
// Reserva más recorrido del deslizador para los siglos con mayor densidad de registros.
const yearAt = (position) => lastYear - Math.round((lastYear - firstYear) * (1 - position / sliderEnd) ** 2) || 1;
const positionAt = (year) => sliderEnd * (1 - Math.sqrt((lastYear - year) / (lastYear - firstYear)));
const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const magnitudeText = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const clock = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short', timeZone: 'UTC' });
const refreshPeriod = 5 * 60 * 1000;
const state = {
  mode: 'historic', historic: [], recent: [], volcanoes: [], tsunamis: [], selection: undefined,
  historicReady: false, volcanoReady: false, tsunamiReady: false, recentReady: false,
  visibleQuakes: [], visibleVolcanoes: [], visibleTsunamis: [],
  meteorites: [], visibleMeteorites: [], meteoriteReady: false,
  magnitudes: { historic: 7, recent: 2.5 }, year: lastYear, wholePeriod: true,
};
let playback;
let refreshTimer;
let pendingRecent;
let lastRecentAttempt = 0;
let globe;
let footprintRequest;
const localFootprints = new Map();

function reportError(message) {
  ui.error.hidden = false;
  ui.error.textContent += (ui.error.textContent ? ' ' : '') + message;
}

try {
  globe = createGlobe(ui.viewer, selectEvent, reportError, (orbiting) => {
    const label = orbiting ? 'Pausar giro automático' : 'Reanudar giro automático';
    ui.orbit.textContent = orbiting ? 'Ⅱ' : '▶';
    ui.orbit.setAttribute('aria-label', label);
    ui.orbit.title = label;
  });
} catch (error) {
  console.error(error);
  reportError('WebGL no está disponible. Puedes consultar las fichas desde el buscador.');
}

function describeValue(value, unit = '') {
  return Number.isFinite(value) ? number.format(value) + unit : 'Sin datos';
}

function node(tag, content, className) {
  const result = document.createElement(tag);
  if (content) result.textContent = content;
  if (className) result.className = className;
  return result;
}

function selectEvent(event) {
  footprintRequest?.abort();
  state.selection = event;
  const hasFootprint = event?.kind === 'quake' || event?.kind === 'volcano';
  globe?.select(event, hasFootprint ? referenceDistance(event) : undefined);
  ui.detail.replaceChildren();
  ui.detail.hidden = !event;
  if (!event) return;

  const quake = event.kind === 'quake';
  const tsunami = event.kind === 'tsunami';
  const meteorite = event.kind === 'meteorite';
  const rows = quake ? [
    [event.calendarDate ? 'Fecha histórica' : 'Fecha UTC', event.calendarDate || date.format(event.time)],
    ['Magnitud', magnitudeText.format(event.mag) + (event.magType ? ` (${event.magType})` : '')],
    ['Profundidad', describeValue(event.depth, ' km')],
  ] : tsunami ? [
    ['Fecha', event.calendarDate], ['País o territorio', event.country || 'Sin datos'],
    ['Clasificación', event.validity], ['Causa', event.cause],
    ['Altura máxima registrada', describeValue(event.height, ' m')],
    ['Observaciones del catálogo', describeValue(event.observations)],
  ] : meteorite ? [
    ['Año de la caída', formatYear(event.year)], ['Clasificación', event.classification || 'Sin datos'],
    ['Masa registrada', describeValue(event.mass, ' g')],
  ] : [
    ['País o territorio', event.country || 'Sin datos'],
    ['Tipo', event.type || 'Sin datos'],
    ['Elevación', describeValue(event.elevation, ' m')],
    ['Primera erupción confirmada', event.firstEruption ? formatYear(event.firstEruption) : 'Sin fecha confirmada'],
    ['Última erupción del catálogo', event.eruption ? formatYear(event.eruption) : 'Sin fecha registrada'],
  ];
  rows.push(['Latitud, longitud', `${number.format(event.lat)}°, ${number.format(event.lon)}°`]);
  const close = node('button', '×', 'close');
  close.setAttribute('aria-label', 'Cerrar ficha');
  close.addEventListener('click', () => selectEvent());
  const list = node('dl');
  for (const [label, value] of rows) list.append(node('dt', label), node('dd', String(value)));
  const label = quake ? `TERREMOTO · ${event.source || 'USGS'}` : {
    tsunami: 'TSUNAMI · NOAA', volcano: 'VOLCÁN · SMITHSONIAN GVP', meteorite: 'METEORITO · THE METEORITICAL SOCIETY',
  }[event.kind];
  ui.detail.append(close, node('span', label, 'kind'), node('h2', event.name), list);
  if (hasFootprint) appendFootprint(event, quake);

  if (event.url?.startsWith('https://')) {
    const source = node('a', tsunami ? 'Ficha y observaciones de NOAA ↗' : 'Consultar ficha original ↗');
    source.href = event.url;
    source.target = '_blank';
    source.rel = 'noopener';
    ui.detail.append(source);
  }
}

function appendFootprint(event, quake) {
  const impact = node('div', '', 'impact');
  const heading = node('h3', 'Alcance');
  const reference = node('p', `Área ilustrativa de ${referenceDistance(event)} km de radio como referencia de distancia.`);
  const status = node('p', 'Buscando datos de alcance…');
  status.setAttribute('role', 'status');
  impact.append(heading, reference, status);
  if (globe) {
    const zoom = node('button', 'Acercar al evento');
    zoom.addEventListener('click', () => globe.focus(event, quake ? 1.085 : 1.024));
    impact.append(zoom);
  }
  ui.detail.append(impact);

  const controller = new AbortController();
  footprintRequest = controller;
  eventFootprint(event, controller.signal).then((result) => {
    if (controller.signal.aborted) return;
    if (!result) {
      status.textContent = quake ? 'No hay un ShakeMap disponible para este terremoto.' : 'El radio es una referencia visual.';
      return;
    }
    reference.hidden = result.features.some(({ geometry }) => ['Polygon', 'MultiPolygon'].includes(geometry.type));
    status.textContent = result.description;
    globe?.showFootprint(result.features, result.color);
    if (globe) {
      const zoom = node('button', 'Centrar en el alcance');
      zoom.addEventListener('click', () => globe.focus(result.focus ?? event, result.distance));
      impact.append(zoom);
    }
    if (result.source) {
      const link = node('a', 'Ver mapa de Copernicus ↗');
      link.href = result.source;
      link.target = '_blank';
      link.rel = 'noopener';
      impact.append(link);
    }
  }).catch(() => {
    if (!controller.signal.aborted) status.textContent = 'No se pudo consultar el ShakeMap.';
  });

}

function updateSearch() {
  const words = normalizeSearch(ui.search.value).split(/\s+/).filter(Boolean);
  ui.results.hidden = words.join('').length < 2;
  ui.results.replaceChildren();
  ui['search-status'].textContent = '';
  if (ui.results.hidden) return;

  const matches = (events) => events.filter((event) => words.every((word) => event.search.includes(word))).slice(0, 6);
  const found = [...matches(state.volcanoes), ...matches(state[state.mode]), ...matches(state.tsunamis), ...matches(state.meteorites)];
  ui['search-status'].textContent = found.length ? `${found.length} resultados mostrados` : 'Sin coincidencias';
  if (!found.length) {
    ui.results.append(node('li', 'Sin coincidencias en los catálogos cargados.', 'empty'));
    return;
  }
  for (const event of found) {
    const item = node('li');
    const button = node('button', event.name);
    const info = event.kind === 'quake' ? `Terremoto · M ${magnitudeText.format(event.mag)} · ${formatYear(event.year)}`
      : event.kind === 'tsunami' ? `Tsunami · ${formatYear(event.year)} · ${event.validity}`
        : event.kind === 'meteorite' ? `Meteorito · ${formatYear(event.year)}`
        : `Volcán · ${event.country || 'Smithsonian GVP'}`;
    button.append(node('small', info));
    button.addEventListener('click', () => locate(event));
    item.append(button);
    ui.results.append(item);
  }
}

function locate(event) {
  if (event.kind === 'volcano') {
    ui['show-volcanoes'].checked = true;
  } else if (event.kind === 'tsunami') {
    ui['show-tsunamis'].checked = true;
  } else if (event.kind === 'meteorite') {
    ui['show-meteorites'].checked = true;
  } else {
    ui['show-quakes'].checked = true;
    if (event.mag < state.magnitudes[state.mode]) {
      state.magnitudes[state.mode] = Math.floor(event.mag * 10 + 1e-8) / 10;
      ui.magnitude.value = state.magnitudes[state.mode];
    }
  }
  if (state.mode === 'historic') {
    stopPlayback();
    globe?.clearHighlights();
    const year = event.kind === 'volcano' ? event.firstEruption : event.year;
    if (year === undefined) {
      state.wholePeriod = true;
      state.year = lastYear;
    } else state.year = Math.max(state.year, year);
  }
  renderEvents();
  selectEvent(event);
  globe?.focus(event);
  ui.results.hidden = true;
  ui.search.focus();
  if (window.matchMedia('(max-width: 760px)').matches) {
    ui.viewer.scrollIntoView({ block: 'start' });
  }
}

function renderLayers() {
  const showQuakes = ui['show-quakes'].checked;
  const showVolcanoes = ui['show-volcanoes'].checked;
  const showTsunamis = ui['show-tsunamis'].checked;
  const showMeteorites = ui['show-meteorites'].checked;
  globe?.showQuakes(showQuakes);
  globe?.showVolcanoes(showVolcanoes);
  globe?.showTsunamis(showTsunamis);
  globe?.showMeteorites(showMeteorites);
  globe?.showPlates(ui['show-plates'].checked);
  const current = state.selection;
  if (current && ((current.kind === 'volcano' && (!showVolcanoes || !state.visibleVolcanoes.includes(current))) ||
      (current.kind === 'tsunami' && (!showTsunamis || !state.visibleTsunamis.includes(current))) ||
      (current.kind === 'meteorite' && (!showMeteorites || !state.visibleMeteorites.includes(current))) ||
      (current.kind === 'quake' && (!showQuakes || !state.visibleQuakes.includes(current))))) {
    selectEvent();
  }
  const ready = state.mode === 'historic' ? state.historicReady : state.recentReady;
  ui['quake-count'].textContent = showQuakes && ready ? number.format(state.visibleQuakes.length) : '—';
  ui['volcano-count'].textContent = showVolcanoes && state.volcanoReady ? number.format(state.visibleVolcanoes.length) : '—';
  ui['tsunami-count'].textContent = showTsunamis && state.tsunamiReady ? number.format(state.visibleTsunamis.length) : '—';
  ui['meteorite-count'].textContent = showMeteorites && state.meteoriteReady ? number.format(state.visibleMeteorites.length) : '—';
}

function renderEvents() {
  const historical = state.mode === 'historic';
  const minimum = state.magnitudes[state.mode];
  state.visibleQuakes = state[state.mode].filter((event) => event.mag >= minimum && (!historical || event.year <= state.year));
  const all = !historical || state.wholePeriod;
  state.visibleVolcanoes = all ? state.volcanoes : state.volcanoes.filter(({ firstEruption }) => firstEruption <= state.year);
  state.visibleTsunamis = all ? state.tsunamis : state.tsunamis.filter(({ year }) => year <= state.year);
  state.visibleMeteorites = all ? state.meteorites : state.meteorites.filter(({ year }) => year <= state.year);
  globe?.setQuakes(state.visibleQuakes);
  globe?.setVolcanoes(state.visibleVolcanoes);
  globe?.setTsunamis(state.visibleTsunamis);
  globe?.setMeteorites(state.visibleMeteorites);
  ui['mag-value'].value = magnitudeText.format(minimum);
  ui.year.value = Math.round(positionAt(state.year));
  ui.year.setAttribute('aria-valuetext', formatYear(state.year));
  ui['year-entry'].value = state.year;
  ui['year-entry'].min = firstYear;
  ui['first-year'].textContent = formatYear(firstYear);
  ui['year-value'].value = formatYear(state.year);
  ui['view-period'].textContent = historical
    ? (state.wholePeriod ? 'Todo el periodo' : `Hasta ${formatYear(state.year)}`)
    : 'Últimas 24 horas · M ≥ 2,5 · USGS';
  renderLayers();
}

function stopPlayback() {
  clearInterval(playback);
  playback = undefined;
  ui.play.textContent = '▶ Reproducir';
  ui.play.setAttribute('aria-pressed', 'false');
}

function highlightArrivals(previousYear) {
  const arrived = (events, yearOf) => events.filter((event) => {
    const year = yearOf(event);
    return year > previousYear && year <= state.year;
  });
  const yearOf = (event) => event.year;
  globe?.highlightEvents([
    ...(ui['show-quakes'].checked ? arrived(state.visibleQuakes, yearOf) : []),
    ...(ui['show-volcanoes'].checked ? arrived(state.visibleVolcanoes, (event) => event.firstEruption) : []),
    ...(ui['show-tsunamis'].checked ? arrived(state.visibleTsunamis, yearOf) : []),
    ...(ui['show-meteorites'].checked ? arrived(state.visibleMeteorites, yearOf) : []),
  ], referenceDistance, localFootprints);
}

function startPlayback() {
  if (!state.historicReady || state.mode !== 'historic') return;
  globe?.clearHighlights();
  state.wholePeriod = false;
  const restart = state.year === lastYear;
  if (restart) state.year = firstYear;
  let position = positionAt(state.year);
  let elapsed = 0;
  let previousTick = performance.now();
  ui.play.textContent = 'Ⅱ Pausar';
  ui.play.setAttribute('aria-pressed', 'true');
  renderEvents();
  if (restart) highlightArrivals(firstYear - 1);
  playback = setInterval(() => {
    const now = performance.now();
    const seconds = Math.min((now - previousTick) / 1000, 0.25);
    previousTick = now;
    const previousYear = state.year;
    const speed = ui['playback-speed'].value;
    if (speed === 'year') {
      elapsed += seconds;
      if (elapsed < 1) return;
      elapsed -= 1;
      state.year = Math.min(lastYear, state.year === -1 ? 1 : state.year + 1);
      position = positionAt(state.year);
    } else {
      elapsed = 0;
      position = Math.min(sliderEnd, position + 12 * Number(speed) * seconds);
      state.year = yearAt(position);
      if (state.year === previousYear && position < sliderEnd) return;
    }
    renderEvents();
    highlightArrivals(previousYear);
    if (state.year === lastYear) stopPlayback();
  }, 125);
}

async function refreshRecent() {
  if (pendingRecent) return pendingRecent;
  lastRecentAttempt = Date.now();
  ui.refresh.disabled = true;
  ui['recent-status'].textContent = 'Consultando el catálogo USGS…';
  pendingRecent = readRecent().then((data) => {
    const selected = state.mode === 'recent' ? state.selection : undefined;
    state.recent = earthquakes(data);
    state.recentReady = true;
    if (selected?.kind === 'quake') selectEvent(state.recent.find((event) => event.id === selected.id));
    const stamp = Number.isFinite(data.metadata?.generated) ? data.metadata.generated : Date.now();
    ui['recent-status'].textContent = `Consultado a las ${clock.format(Date.now())} UTC. Datos del USGS de las ${clock.format(stamp)} UTC. Actualización automática cada 5 min.`;
    if (state.mode === 'recent') {
      renderEvents();
      updateSearch();
    }
  }).catch(() => {
    ui['recent-status'].textContent = state.recentReady
      ? 'USGS no responde. Se muestran los últimos datos disponibles. Reintento automático cada 5 min.'
      : 'No se pudo consultar USGS. Reintento automático cada 5 min.';
  }).finally(() => {
    ui.refresh.disabled = false;
    pendingRecent = undefined;
  });
  return pendingRecent;
}

function setMode(mode) {
  if (mode === state.mode) return;
  stopPlayback();
  globe?.clearHighlights();
  clearInterval(refreshTimer);
  if (state.selection?.kind === 'quake') selectEvent();
  state.mode = mode;
  const historical = mode === 'historic';
  ui.historic.setAttribute('aria-pressed', historical);
  ui.recent.setAttribute('aria-pressed', !historical);
  ui.timeline.hidden = !historical;
  ui['recent-options'].hidden = historical;
  ui['view-mode'].textContent = historical ? 'Exploración histórica' : 'Terremotos en directo';
  ui.magnitude.min = historical ? 6 : 2.5;
  ui.magnitude.value = state.magnitudes[mode];
  ui['mag-min'].textContent = magnitudeText.format(Number(ui.magnitude.min));
  renderEvents();
  updateSearch();
  if (!historical) {
    refreshRecent();
    refreshTimer = setInterval(refreshRecent, refreshPeriod);
  }
}

ui.historic.addEventListener('click', () => setMode('historic'));
ui.recent.addEventListener('click', () => setMode('recent'));
ui.refresh.addEventListener('click', refreshRecent);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.mode === 'recent' && Date.now() - lastRecentAttempt >= refreshPeriod) refreshRecent();
});
ui['show-plates'].addEventListener('change', renderLayers);
for (const key of ['show-quakes', 'show-volcanoes', 'show-tsunamis', 'show-meteorites']) {
  ui[key].addEventListener('change', () => {
    globe?.clearHighlights();
    renderLayers();
  });
}
ui.magnitude.addEventListener('input', () => {
  globe?.clearHighlights();
  state.magnitudes[state.mode] = Number(ui.magnitude.value);
  renderEvents();
});
ui.year.addEventListener('input', () => {
  stopPlayback();
  globe?.clearHighlights();
  state.wholePeriod = false;
  state.year = yearAt(Number(ui.year.value));
  renderEvents();
});
ui['year-entry'].addEventListener('change', () => {
  stopPlayback();
  globe?.clearHighlights();
  const year = ui['year-entry'].valueAsNumber;
  if (Number.isFinite(year)) {
    state.wholePeriod = false;
    state.year = Math.min(lastYear, Math.max(firstYear, Math.round(year))) || 1;
  }
  renderEvents();
});
ui.play.addEventListener('click', () => playback ? stopPlayback() : startPlayback());
ui['all-years'].addEventListener('click', () => {
  stopPlayback();
  globe?.clearHighlights();
  state.year = lastYear;
  state.wholePeriod = true;
  renderEvents();
});
ui.search.addEventListener('input', updateSearch);
ui.search.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !ui.results.hidden) {
    event.preventDefault();
    ui.results.querySelector('button')?.click();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!ui.results.hidden) {
    ui.results.hidden = true;
    ui.search.focus();
  } else {
    selectEvent();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.search')) ui.results.hidden = true;
});
ui['zoom-in'].addEventListener('click', () => globe?.zoom(0.78));
ui['zoom-out'].addEventListener('click', () => globe?.zoom(1.28));
ui['reset-view'].addEventListener('click', () => globe?.reset());
ui.orbit.addEventListener('click', () => globe?.toggleOrbit());
ui['orbit-speed'].addEventListener('input', () => {
  const speed = ui['orbit-speed'].valueAsNumber;
  ui['orbit-speed-value'].value = `${number.format(speed)}×`;
  globe?.setOrbitSpeed(speed);
});

for (const event of [{ kind: 'quake', id: 'us6000jllz' }]) {
  eventFootprint(event, AbortSignal.timeout(12000)).then((result) => {
    if (result) localFootprints.set(event.kind + ':' + event.id, result.features);
  }).catch(() => { /* El pulso conserva su área de referencia. */ });
}

ui.play.disabled = true;
renderEvents();
const modernQuakes = loadCatalog('terremotos').then(earthquakes).catch(() => {
  reportError('No se pudo cargar el catálogo histórico de USGS.');
  return [];
});
const olderQuakes = loadCatalog('terremotos-antiguos').then(oldEarthquakes).catch(() => {
  reportError('No se pudo cargar el catálogo anterior a 1900 de NOAA.');
  return [];
});
const quakesReady = Promise.all([modernQuakes, olderQuakes]).then(([modern, older]) => {
  state.historic = [...modern, ...older].sort((a, b) => b.year - a.year || (b.time ?? 0) - (a.time ?? 0));
  state.historicReady = true;
  renderEvents();
  updateSearch();
});

const dates = eruptionYears().catch(() => {
  reportError('No se pudieron cargar las fechas de erupciones.');
  return {};
});
const volcanoesReady = Promise.all([loadCatalog('volcanes'), dates]).then(([data, years]) => {
  state.volcanoes = volcanoes(data).map((event) => ({ ...event, firstEruption: years[event.id]?.[0] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  firstYear = state.volcanoes.reduce((oldest, event) => Math.min(oldest, event.firstEruption ?? oldest), firstYear);
  state.volcanoReady = true;
  renderEvents();
  updateSearch();
}).catch(() => reportError('No se pudo cargar el catálogo de volcanes.'));

const tsunamisReady = loadCatalog('tsunamis').then((data) => {
  state.tsunamis = tsunamis(data).sort((a, b) => b.year - a.year);
  state.tsunamiReady = true;
  renderEvents();
  updateSearch();
}).catch(() => reportError('No se pudo cargar el catálogo de tsunamis.'));

const meteoritesReady = loadCatalog('meteoritos').then((data) => {
  state.meteorites = meteorites(data).sort((a, b) => b.year - a.year);
  state.meteoriteReady = true;
  renderEvents();
  updateSearch();
}).catch(() => reportError('No se pudo cargar el catálogo de meteoritos.'));

Promise.all([quakesReady, volcanoesReady, tsunamisReady, meteoritesReady]).then(() => { ui.play.disabled = false; });

loadCatalog('placas').then(({ features }) => globe?.loadPlates(features))
  .catch(() => reportError('No se pudieron cargar los límites tectónicos.'));

