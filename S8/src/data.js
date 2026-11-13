const dataFolder = import.meta.env.BASE_URL + 'data/';
export const recentUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

async function readGeoJSON(url, options) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Se esperaba una colección GeoJSON');
  }
  return data;
}

export async function loadCatalog(file, options) {
  return readGeoJSON(dataFolder + file + '.geojson', options);
}

export function readRecent() {
  return readGeoJSON(recentUrl, { cache: 'no-cache' });
}

export function normalizeSearch(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function formatYear(year) {
  return year < 0 ? `${-year} a. C.` : String(year);
}

export function catalogDate(year, month, day) {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return [day > 0 && months[month - 1] ? day : null, months[month - 1], formatYear(year)].filter(Boolean).join(' ');
}

export async function eruptionYears() {
  const response = await fetch(dataFolder + 'erupciones.json', { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function oldEarthquakes({ features }) {
  return features.map(({ geometry, properties: p }) => ({
    id: p.ID, kind: 'quake', source: 'NOAA', name: p.LOCATION_NAME || p.COUNTRY || 'Ubicación sin nombre',
    lon: geometry.coordinates[0], lat: geometry.coordinates[1],
    depth: p.EQ_DEPTH, mag: p.EQ_MAGNITUDE, year: p.YEAR, url: p.URL,
    calendarDate: catalogDate(p.YEAR, p.MONTH, p.DAY),
    search: normalizeSearch(`${p.LOCATION_NAME || ''} ${p.COUNTRY || ''} ${p.YEAR}`),
  }));
}

const tsunamiCauses = ['Desconocida', 'Terremoto', 'Posible terremoto', 'Terremoto y deslizamiento',
  'Volcán y terremoto', 'Volcán, terremoto y deslizamiento', 'Volcán', 'Volcán y deslizamiento',
  'Deslizamiento', 'Perturbación meteorológica', 'Explosión', 'Marea astronómica'];

export function tsunamis({ features }) {
  return features.map(({ id, geometry, properties: p }) => ({
    id, kind: 'tsunami', name: p.locationName || p.country || 'Ubicación sin nombre',
    lon: geometry.coordinates[0], lat: geometry.coordinates[1],
    year: p.year, calendarDate: catalogDate(p.year, p.month, p.day),
    country: p.country, cause: tsunamiCauses[p.causeCode] || 'Sin datos',
    validity: p.eventValidity === 4 ? 'Confirmado' : 'Probable',
    height: p.maxWaterHeight, observations: p.numRunups,
    url: `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${id}`,
    search: normalizeSearch(`${p.locationName || ''} ${p.country || ''} ${p.year} tsunami`),
  }));
}

export function meteorites({ features }) {
  return features.map(({ id, geometry, properties: p }) => ({
    id, kind: 'meteorite', name: p.name,
    lon: geometry.coordinates[0], lat: geometry.coordinates[1],
    year: p.year, classification: p.classification, mass: p.mass,
    url: `https://www.lpi.usra.edu/meteor/metbull.php?code=${id}`,
    search: normalizeSearch(`${p.name} ${p.year} meteorito`),
  }));
}

export function earthquakes({ features }) {
  return features.flatMap(({ id, geometry, properties: p }) => {
    if (geometry?.type !== 'Point' || !Number.isFinite(p.mag) || !Number.isFinite(p.time)) return [];
    const [lon, lat, depth] = geometry.coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
    const name = p.place || p.title || 'Ubicación sin nombre';
    return [{
      id, kind: 'quake', name, lon, lat, depth, mag: p.mag, magType: p.magType,
      time: p.time, year: new Date(p.time).getUTCFullYear(), url: p.url,
      search: normalizeSearch(`${name} ${p.title || ''} ${id}`),
    }];
  });
}

export function volcanoes({ features }) {
  return features.flatMap(({ geometry, properties: p }) => {
    if (geometry?.type !== 'Point') return [];
    const [lon, lat] = geometry.coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !p.Volcano_Name) return [];
    return [{
      id: p.Volcano_Number, kind: 'volcano', name: p.Volcano_Name, lon, lat,
      country: p.Country, elevation: p.Elevation, eruption: p.Last_Eruption_Year,
      type: p.Primary_Volcano_Type,
      url: `https://volcano.si.edu/volcano.cfm?vn=${p.Volcano_Number}`,
      search: normalizeSearch(`${p.Volcano_Name} ${p.Country || ''} ${p.Subregion || ''}`),
    }];
  });
}

