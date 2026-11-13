import * as THREE from 'three';

const textureRoot = import.meta.env.BASE_URL + 'textures/';
const uvBounds = (west, south, east, north) =>
  new THREE.Vector4((180 + west) / 360, (90 + south) / 180, (180 + east) / 360, (90 + north) / 180);
const canaryBounds = uvBounds(-18.25, 27.55, -13.33, 29.48);
const palmaBounds = uvBounds(-18.04, 28.40, -17.65, 28.88);

export function addEarth(scene, renderer, onError) {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
  const material = new THREE.MeshPhongMaterial({ color: '#eaf3ff', shininess: 22, specular: '#202f45', bumpScale: 0.028 });
  const geometry = new THREE.SphereGeometry(1, 256, 160);
  scene.add(new THREE.Mesh(geometry, material));

  const regional = { value: null };
  const regionalReady = { value: false };
  const palma = { value: null };
  const palmaReady = { value: false };
  const nearSurface = { value: 0 };
  const oceanRelief = { value: null };
  const oceanReady = { value: false };
  function load(file, color, apply, onFailure) {
    loader.load(textureRoot + file, (texture) => {
      if (color) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      apply(texture);
      material.needsUpdate = true;
    }, undefined, onFailure);
  }

  // La ortofoto está en la misma proyección y se mezcla solo donde tiene cobertura.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.regionalMap = regional;
    shader.uniforms.regionalReady = regionalReady;
    shader.uniforms.regionalBounds = { value: canaryBounds };
    shader.uniforms.palmaMap = palma;
    shader.uniforms.palmaReady = palmaReady;
    shader.uniforms.palmaBounds = { value: palmaBounds };
    shader.uniforms.nearSurface = nearSurface;
    shader.uniforms.oceanRelief = oceanRelief;
    shader.uniforms.oceanReady = oceanReady;
    shader.fragmentShader = `
      uniform sampler2D regionalMap, palmaMap;
      uniform vec4 regionalBounds, palmaBounds;
      uniform bool regionalReady, palmaReady;
      uniform float nearSurface;
      uniform sampler2D oceanRelief;
      uniform bool oceanReady;
      float edgeDistance(vec2 uv) {
        return min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      }
    ` + shader.fragmentShader;
    const heightSource = THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('texture2D( bumpMap,', 'surfaceHeight(');
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', heightSource.replace(
      'uniform float bumpScale;',
      `uniform float bumpScale;
      vec4 surfaceHeight(vec2 uv) {
        float land = texture2D(bumpMap, uv).r;
        float sea = oceanReady ? texture2D(oceanRelief, uv).r - 1.0 : 0.0;
        return vec4(land + sea * 0.32 * (1.0 - nearSurface));
      }`,
    ));
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 ground = texture2D(map, vMapUv);
        vec2 local = (vMapUv - regionalBounds.xy) / (regionalBounds.zw - regionalBounds.xy);
        if (regionalReady && local.x >= 0.0 && local.x <= 1.0 && local.y >= 0.0 && local.y <= 1.0) {
          vec4 aerial = texture2D(regionalMap, local);
          float edge = edgeDistance(local);
          ground.rgb = mix(ground.rgb, vec3(0.019, 0.050, 0.125), nearSurface * 0.94 * smoothstep(0.0, 0.11, edge));
          ground.rgb = mix(ground.rgb, aerial.rgb * 1.12, aerial.a * smoothstep(0.0, 0.025, edge));
        }
        vec2 detailUv = (vMapUv - palmaBounds.xy) / (palmaBounds.zw - palmaBounds.xy);
        if (palmaReady && edgeDistance(detailUv) >= 0.0 && nearSurface > 0.0) {
          vec4 island = texture2D(palmaMap, detailUv);
          ground.rgb = mix(ground.rgb, island.rgb * 1.12, island.a * nearSurface * smoothstep(0.0, 0.055, edgeDistance(detailUv)));
        }
        diffuseColor *= ground;
      #endif
    `);
  };

  const loadBase = () => load('tierra.jpg', true, (texture) => { material.map = texture; },
    () => onError('No se pudo cargar la textura terrestre.'));
  if (renderer.capabilities.maxTextureSize >= 8192) {
    load('tierra-8k.jpg', true, (texture) => { material.map = texture; }, loadBase);
  } else loadBase();
  const loadSmallerRelief = () => load('elevacion-4k.jpg', false, (texture) => { material.bumpMap = texture; });
  if (renderer.capabilities.maxTextureSize >= 5400) {
    load('elevacion.jpg', false, (texture) => { material.bumpMap = texture; }, loadSmallerRelief);
  } else loadSmallerRelief();
  const bathymetry = renderer.capabilities.maxTextureSize >= 5400 ? 'batimetria.jpg' : 'batimetria-4k.jpg';
  load(bathymetry, false, (texture) => {
    oceanRelief.value = texture;
    oceanReady.value = true;
  });
  load('canarias.png', true, (texture) => {
    regional.value = texture;
    regionalReady.value = true;
  });
  load('la-palma.png', true, (texture) => {
    palma.value = texture;
    palmaReady.value = true;
  });

  // La intensidad del resplandor aumenta hacia el borde visible del planeta.
  const atmosphere = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 normalView;
      varying vec3 eye;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        normalView = normalize(normalMatrix * normal);
        eye = -view.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying vec3 normalView;
      varying vec3 eye;
      void main() {
        float rim = pow(max(0.0, 1.0 - abs(dot(normalize(normalView), normalize(eye)))), 5.0);
        gl_FragColor = vec4(0.16, 0.42, 0.90, rim * 0.72);
      }
    `,
  }));
  atmosphere.scale.setScalar(1.024);
  scene.add(atmosphere);
  return {
    update(altitude) {
      nearSurface.value = 1 - THREE.MathUtils.smoothstep(altitude, 0.035, 0.18);
      // Suaviza el mapa global en vistas cercanas para mantener nítida la ortofoto.
      material.bumpScale = THREE.MathUtils.lerp(0.001, 0.040, THREE.MathUtils.smoothstep(altitude, 0.012, 0.42));
    },
  };
}

