import { loadCatalog } from './data.js';

export function referenceDistance(event) {
  return event.kind === 'volcano' ? 25 : 100;
}

function seismicFootprint(data) {
  const lines = data.features.filter(({ geometry, properties }) =>
    ['LineString', 'MultiLineString'].includes(geometry?.type) && Number.isFinite(Number(properties?.value)));
  const levels = [...new Set(lines.map(({ properties }) => Number(properties.value)))].sort((a, b) => a - b);
  const level = levels.find((value) => value >= 4) ?? levels[0];
  if (level === undefined) return null;
  return {
    features: lines.filter(({ properties }) => Number(properties.value) === level),
    description: `Contorno de intensidad MMI ${level} modelado por USGS ShakeMap.`,
    color: '#ff945e',
  };
}

export async function eventFootprint(event, signal) {
  if (event.kind === 'volcano') return null;
  if (event.id === 'us6000jllz') {
    return seismicFootprint(await loadCatalog('shakemap-pazarcik', { signal }));
  }
  if (!event.id || event.source === 'NOAA') return null;

  const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
  url.search = new URLSearchParams({ eventid: event.id, format: 'geojson' });
  const options = { signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]) };
  const response = await fetch(url, options);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('USGS no disponible');
  const detail = await response.json();
  const product = detail.properties?.products?.shakemap?.find(({ status }) => status !== 'DELETE');
  const contour = product?.contents?.['download/cont_mi.json']?.url;
  if (!contour || new URL(contour).origin !== url.origin) return null;
  const geometry = await fetch(contour, options);
  if (!geometry.ok) throw new Error('Contorno no disponible');
  return seismicFootprint(await geometry.json());
}

