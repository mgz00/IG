import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addEarth } from './earth.js';
import { addSky } from './sky.js';

const radius = 1;
const markerRadius = 1.00035;
const home = new THREE.Vector3(1.4, 1.05, 3);
const project = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const zoomFactor = (distance) => THREE.MathUtils.clamp(3.2 / distance, 0.8, 2.1);
const eventColors = { quake: '#ff8a6b', volcano: '#f7cf78', tsunami: '#77d6ff', meteorite: '#dbadff' };

// La esfera de Three.js sitúa Greenwich en +X y el este en dirección -Z.
function position(lon, lat, r = radius) {
  const longitude = THREE.MathUtils.degToRad(lon);
  const latitude = THREE.MathUtils.degToRad(lat);
  const horizontal = Math.cos(latitude) * r;
  return new THREE.Vector3(horizontal * Math.cos(longitude), r * Math.sin(latitude), -horizontal * Math.sin(longitude));
}

function markerSize(event) {
  if (event.kind !== 'quake') return event.kind === 'tsunami' ? 9 : 8;
  return THREE.MathUtils.clamp(4 + (event.mag - 2.5) * 1.1, 4, 13);
}

function markerLayer(kind, renderer, camera) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(eventColors[kind]) },
      triangle: { value: kind === 'volcano' },
      diamond: { value: kind === 'tsunami' },
      square: { value: kind === 'meteorite' },
      scale: { value: 1 },
    },
    vertexShader: `
      attribute float size;
      uniform float scale;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale;
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform bool triangle;
      uniform bool diamond;
      uniform bool square;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = triangle ? max(p.y - 0.75, abs(p.x) - (p.y + 0.9) * 0.53) : length(p) - 0.79;
        if (diamond) d = abs(p.x) + abs(p.y) - 0.96;
        if (square) d = max(abs(p.x), abs(p.y)) - 0.65;
        if (d > 0.0) discard;
        gl_FragColor = vec4(mix(tint * 0.3, tint, smoothstep(0.0, 0.27, -d)), 1.0);
        #include <encodings_fragment>
      }
    `,
  });
  const points = new THREE.Points(new THREE.BufferGeometry(), material);
  points.frustumCulled = false;
  points.onBeforeRender = () => {
    material.uniforms.scale.value = renderer.getPixelRatio() * zoomFactor(camera.position.length());
  };
  let markers = [];
  return {
    points,
    get markers() { return points.visible ? markers : []; },
    update(events) {
      markers = events.map((event) => ({ event, vector: position(event.lon, event.lat, markerRadius) }));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(markers.flatMap(({ vector }) => vector.toArray()), 3));
      geometry.setAttribute('size', new THREE.Float32BufferAttribute(events.map(markerSize), 1));
      points.geometry.dispose();
      points.geometry = geometry;
    },
  };
}

function boundaryGeometry(features, overlayRadius = 1.0012) {
  const vertices = [];
  for (const { geometry } of features) {
    const { type, coordinates } = geometry ?? {};
    if (!['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(type)) continue;
    const lines = type === 'LineString' ? [coordinates] : type === 'MultiPolygon' ? coordinates.flat() : coordinates;
    for (const line of lines) {
      for (let index = 1; index < line.length; index++) {
        const a = position(...line[index - 1].slice(0, 2));
        const b = position(...line[index].slice(0, 2));
        const segments = Math.max(1, Math.ceil(a.angleTo(b) / 0.025));
        // Subdividir los tramos evita que la cuerda atraviese la superficie del globo.
        for (let step = 0; step < segments; step++) {
          for (const t of [step / segments, (step + 1) / segments]) {
            const v = a.clone().lerp(b, t).setLength(overlayRadius);
            vertices.push(v.x, v.y, v.z);
          }
        }
      }
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
}

function rangePoints(event, km, segments) {
  const center = position(event.lon, event.lat);
  const east = position(event.lon + 90, 0);
  const north = center.clone().cross(east).normalize();
  const angle = km / 6371;
  const vertices = [];
  for (let i = 0; i <= segments; i++) {
    const heading = i * 2 * Math.PI / segments;
    vertices.push(center.clone().multiplyScalar(Math.cos(angle))
      .addScaledVector(east, Math.cos(heading) * Math.sin(angle))
      .addScaledVector(north, Math.sin(heading) * Math.sin(angle)).setLength(1.00012));
  }
  return vertices;
}

function rangeGeometry(event, km) {
  const vertices = rangePoints(event, km, 96);
  const origin = position(event.lon, event.lat, 1.00012);
  const triangles = [];
  for (let i = 1; i < vertices.length; i++) {
    triangles.push(origin, vertices[i - 1], vertices[i]);
  }
  return {
    outline: new THREE.BufferGeometry().setFromPoints(vertices),
    fill: new THREE.BufferGeometry().setFromPoints(triangles),
  };
}

function pulseLayer(scene, renderer) {
  const batches = [];
  const markerMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { fade: { value: 1 }, pixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
      uniform float pixelRatio;
      uniform float fade;
      varying vec3 tint;
      void main() {
        tint = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (18.0 + 14.0 * (1.0 - fade)) * pixelRatio;
      }
    `,
    fragmentShader: `
      uniform float fade;
      varying vec3 tint;
      void main() {
        float d = length(gl_PointCoord * 2.0 - 1.0);
        float core = 1.0 - smoothstep(0.06, 0.30, d);
        float ring = 1.0 - smoothstep(0.055, 0.15, abs(d - 0.69));
        gl_FragColor = vec4(mix(tint, vec3(1.0), core * 0.65), fade * max(core, 0.85 * ring));
        #include <encodings_fragment>
      }
    `,
  });
  const areaMaterial = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
  });

  const trailMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { progress: { value: 0 } },
    vertexShader: `
      uniform float progress;
      attribute vec3 target;
      attribute float tip;
      varying float glow;
      void main() {
        float head = min(1.0, progress);
        float tail = max(0.0, progress - 0.38);
        vec3 point = mix(position, target, mix(tail, head, tip));
        glow = tip;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
      }
    `,
    fragmentShader: `
      varying float glow;
      void main() {
        gl_FragColor = vec4(mix(vec3(0.45, 0.18, 1.0), vec3(1.0, 0.92, 0.82), glow), glow);
        #include <encodings_fragment>
      }
    `,
  });

  function geometry(points, colors) {
    return new THREE.BufferGeometry().setFromPoints(points)
      .setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  function dispose(batch) {
    const objects = [batch.perimeter, batch.markers, batch.area, batch.trails].filter(Boolean);
    for (const object of objects) {
      scene.remove(object);
      object.geometry.dispose();
      object.material.dispose();
    }
  }

  return {
    add(events, referenceDistance, localFootprints) {
      if (!events.length) return;
      const centers = [], centerColors = [], areas = [], areaColors = [];
      const trailStarts = [], trailEnds = [], trailTips = [];
      for (const event of events) {
        if (event.kind === 'meteorite') {
          // El catálogo da el punto de caída. La inclinación de la estela es ilustrativa.
          const target = position(event.lon, event.lat, markerRadius);
          const start = target.clone().multiplyScalar(1.19)
            .addScaledVector(position(event.lon + 90, 0), 0.23)
            .addScaledVector(new THREE.Vector3(0, 1, 0), 0.09);
          trailStarts.push(start, start);
          trailEnds.push(...target.toArray(), ...target.toArray());
          trailTips.push(0, 1);
          continue;
        }
        const { r, g, b } = new THREE.Color(eventColors[event.kind]);
        centers.push(position(event.lon, event.lat, markerRadius + 0.00012));
        centerColors.push(r, g, b);
        if (event.kind === 'tsunami') continue;
        const features = localFootprints.get(event.kind + ':' + event.id);
        if (features) {
          const perimeter = new THREE.LineSegments(boundaryGeometry(features, 1.00022),
            new THREE.LineBasicMaterial({ color: eventColors[event.kind], transparent: true, depthWrite: false }));
          perimeter.renderOrder = 4;
          scene.add(perimeter);
          batches.push({ perimeter, start: performance.now() });
          if (features.some(({ geometry }) => ['Polygon', 'MultiPolygon'].includes(geometry.type))) {
            const polygon = footprintFill(features);
            const coordinates = polygon.getAttribute('position');
            for (let i = 0; i < coordinates.count; i++) {
              areas.push(new THREE.Vector3().fromBufferAttribute(coordinates, i));
              areaColors.push(r, g, b);
            }
            polygon.dispose();
            continue;
          }
        }
        const ring = rangePoints(event, referenceDistance(event), 32);
        const center = position(event.lon, event.lat, 1.00012);
        for (let i = 1; i < ring.length; i++) {
          areas.push(center, ring[i - 1], ring[i]);
          areaColors.push(r, g, b, r, g, b, r, g, b);
        }
      }
      const markers = new THREE.Points(geometry(centers, centerColors), markerMaterial.clone());
      const area = new THREE.Mesh(geometry(areas, areaColors), areaMaterial.clone());
      markers.renderOrder = 5;
      area.renderOrder = 1;
      scene.add(markers, area);
      let trails;
      if (trailStarts.length) {
        const paths = new THREE.BufferGeometry().setFromPoints(trailStarts)
          .setAttribute('target', new THREE.Float32BufferAttribute(trailEnds, 3))
          .setAttribute('tip', new THREE.Float32BufferAttribute(trailTips, 1));
        trails = new THREE.LineSegments(paths, trailMaterial.clone());
        trails.frustumCulled = false;
        trails.renderOrder = 6;
        scene.add(trails);
      }
      batches.push({ markers, area, trails, start: performance.now() });
    },
    update(now) {
      while (batches.length && now - batches[0].start >= 1050) dispose(batches.shift());
      for (const { markers, area, perimeter, trails, start } of batches) {
        const fade = 1 - THREE.MathUtils.smoothstep(now - start, 180, 1050);
        if (perimeter) {
          perimeter.material.opacity = fade;
        } else {
          markers.material.uniforms.fade.value = fade;
          area.material.opacity = 0.42 * fade;
          if (trails) trails.material.uniforms.progress.value = Math.min(1.38, (now - start) / 750);
        }
      }
    },
    clear() {
      for (const batch of batches.splice(0)) dispose(batch);
    },
  };
}

function footprintFill(features) {
  const vertices = [];
  for (const { geometry } of features) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    for (const polygon of polygons) {
      const rings = polygon.map((ring) => ring.slice(0, -1).map(([lon, lat]) => new THREE.Vector2(lon, lat)));
      const [outer, ...holes] = rings;
      const indices = THREE.ShapeUtils.triangulateShape(outer, holes);
      const points = rings.flat().map(({ x, y }) => position(x, y, 1.00013));
      for (const face of indices) vertices.push(...face.map((index) => points[index]));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(vertices);
}

export function createGlobe(container, onPick, onError, onOrbitChange) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050914');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  addSky(scene, renderer);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Globo 3D. También puedes seleccionar eventos desde el buscador.');
  canvas.setAttribute('role', 'img');
  container.prepend(canvas);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.0008, 65);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.003;
  controls.maxDistance = 6.5;

  const earth = addEarth(scene, renderer, onError);

  scene.add(new THREE.AmbientLight('#c0d7ff', 0.67));
  const sun = new THREE.DirectionalLight('#fff5e7', 1.48);
  const sunOffset = new THREE.Vector3(-0.78, 0.66, 0);
  scene.add(sun);

  const plates = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
    color: '#72ded9', transparent: true, opacity: 0.72, depthWrite: false,
  }));
  scene.add(plates);
  const quakes = markerLayer('quake', renderer, camera);
  const volcanoes = markerLayer('volcano', renderer, camera);
  const tsunamis = markerLayer('tsunami', renderer, camera);
  const meteorites = markerLayer('meteorite', renderer, camera);
  scene.add(quakes.points, volcanoes.points, tsunamis.points, meteorites.points);
  const reference = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({
    color: '#fff1bb', dashSize: 0.0009, gapSize: 0.00055, transparent: true, opacity: 0.97, depthWrite: false,
  }));
  const footprint = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
    color: '#ff975a', depthWrite: false, transparent: true, opacity: 0.98,
  }));
  const fill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
    color: '#ff975a', side: THREE.DoubleSide, transparent: true, opacity: 0.33, depthWrite: false,
  }));
  reference.visible = footprint.visible = fill.visible = false;
  reference.renderOrder = footprint.renderOrder = 3;
  fill.renderOrder = 2;
  scene.add(fill, reference, footprint);
  const pulses = pulseLayer(scene, renderer);

  const observer = new ResizeObserver(() => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / Math.max(1, height);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(22)) / Math.max(0.55, Math.min(camera.aspect, 1)),
    ));
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });
  observer.observe(canvas);

  let movement;
  let press;
  let orbiting = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let orbitSpeed = 1;
  const axis = new THREE.Vector3(0, 1, 0);
  let lastFrame;
  onOrbitChange(orbiting);

  function setOrbit(active) {
    if (orbiting === active) return;
    orbiting = active;
    onOrbitChange(active);
  }

  controls.addEventListener('start', () => {
    movement = undefined;
    setOrbit(false);
  });
  canvas.addEventListener('pointerdown', (event) => {
    press = event.isPrimary && event.button === 0 && !press ? [event.clientX, event.clientY] : undefined;
  });
  canvas.addEventListener('pointercancel', () => { press = undefined; });
  canvas.addEventListener('pointerup', (event) => {
    if (!press) return;
    const [x, y] = press;
    press = undefined;
    if (Math.hypot(event.clientX - x, event.clientY - y) > 5) return;
    const bounds = canvas.getBoundingClientRect();
    let closest;
    let best = Infinity;
    for (const { event: candidate, vector } of [...tsunamis.markers, ...quakes.markers, ...volcanoes.markers, ...meteorites.markers]) {
      // El hemisferio visible se reduce al acercar la cámara a la superficie.
      if (vector.dot(camera.position) <= radius ** 2) continue;
      project.copy(vector).project(camera);
      const dx = (project.x + 1) * bounds.width / 2 + bounds.left - x;
      const dy = (1 - project.y) * bounds.height / 2 + bounds.top - y;
      const distance = Math.hypot(dx, dy);
      const tolerance = Math.max(6, markerSize(candidate) * zoomFactor(camera.position.length()) / 2 + 3);
      if (distance < tolerance && distance < best) {
        best = distance;
        closest = candidate;
      }
    }
    onPick(closest);
  });

  function moveTo(destination) {
    setOrbit(false);
    const from = camera.position.clone().normalize();
    const to = destination.clone().normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);
    movement = { from, rotation, start: performance.now(), distance: camera.position.length(), target: destination.length() };
  }

  renderer.setAnimationLoop((now) => {
    const delta = lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    if (orbiting) camera.position.applyAxisAngle(axis, -0.095 * orbitSpeed * delta);
    if (movement) {
      const fraction = THREE.MathUtils.clamp((now - movement.start) / 650, 0, 1);
      const eased = fraction * fraction * (3 - 2 * fraction);
      const rotation = new THREE.Quaternion().slerp(movement.rotation, eased);
      camera.position.copy(movement.from).applyQuaternion(rotation)
        .multiplyScalar(THREE.MathUtils.lerp(movement.distance, movement.target, eased));
      if (fraction === 1) movement = undefined;
    }
    controls.rotateSpeed = THREE.MathUtils.clamp((camera.position.length() - 1) * 0.58, 0.003, 0.84);
    controls.update();
    earth.update(camera.position.length() - 1);
    cameraDirection.copy(camera.position).normalize();
    sun.position.copy(cameraDirection).add(sunOffset);
    pulses.update(now);
    renderer.render(scene, camera);
  });

  return {
    setOrbitSpeed(speed) { orbitSpeed = speed; },
    highlightEvents: pulses.add,
    clearHighlights: pulses.clear,
    showPlates(visible) { plates.visible = visible; },
    loadPlates(features) {
      plates.geometry.dispose();
      plates.geometry = boundaryGeometry(features);
    },
    setQuakes(events) { quakes.update(events); },
    setVolcanoes(events) { volcanoes.update(events); },
    setTsunamis(events) { tsunamis.update(events); },
    setMeteorites(events) { meteorites.update(events); },
    showQuakes(visible) { quakes.points.visible = visible; },
    showVolcanoes(visible) { volcanoes.points.visible = visible; },
    showTsunamis(visible) { tsunamis.points.visible = visible; },
    showMeteorites(visible) { meteorites.points.visible = visible; },
    toggleOrbit() {
      movement = undefined;
      setOrbit(!orbiting);
    },
    select(event, referenceKm) {
      reference.visible = Boolean(event && referenceKm);
      footprint.visible = false;
      fill.visible = reference.visible;
      if (!event) return;
      setOrbit(false);
      if (!referenceKm) return;
      const { outline, fill: area } = rangeGeometry(event, referenceKm);
      reference.geometry.dispose();
      reference.geometry = outline;
      reference.computeLineDistances();
      fill.geometry.dispose();
      fill.geometry = area;
      fill.material.color.set(event.kind === 'volcano' ? '#ffd067' : '#ff966b');
    },
    showFootprint(features, color) {
      footprint.geometry.dispose();
      footprint.geometry = boundaryGeometry(features, 1.0002);
      footprint.material.color.set(color);
      footprint.visible = true;
      const hasArea = features.some(({ geometry }) => ['Polygon', 'MultiPolygon'].includes(geometry.type));
      if (hasArea) {
        reference.visible = false;
        fill.geometry.dispose();
        fill.geometry = footprintFill(features);
        fill.material.color.set(color);
      }
    },
    focus(event, distance = event.kind === 'volcano' ? 1.075 : 1.30) {
      moveTo(position(event.lon, event.lat, distance));
    },
    reset() { moveTo(home); },
    zoom(factor) {
      const distance = THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance);
      moveTo(camera.position.clone().setLength(distance));
    },
  };
}


