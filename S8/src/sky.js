import * as THREE from 'three';

export function addSky(scene, renderer) {
  let seed = 4039;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const positions = [];
  const appearances = [];
  for (let i = 0; i < 5800; i++) {
    const y = 2 * random() - 1;
    const azimuth = 2 * Math.PI * random();
    const horizontal = Math.sqrt(1 - y * y);
    positions.push(43 * horizontal * Math.cos(azimuth), 43 * y, 43 * horizontal * Math.sin(azimuth));
    const brightness = random() ** 4;
    appearances.push(1.45 + brightness * 2.7, 0.24 + brightness * 0.72, random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('appearance', new THREE.Float32BufferAttribute(appearances, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `
      uniform float pixelRatio;
      attribute vec3 appearance;
      varying vec2 tint;
      void main() {
        tint = appearance.yz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = appearance.x * pixelRatio;
      }
    `,
    fragmentShader: `
      varying vec2 tint;
      void main() {
        float distanceToCenter = length(gl_PointCoord * 2.0 - 1.0);
        float glow = 1.0 - smoothstep(0.12, 1.0, distanceToCenter);
        vec3 star = mix(vec3(0.60, 0.76, 1.0), vec3(1.0, 0.87, 0.71), tint.y);
        gl_FragColor = vec4(star, glow * tint.x);
      }
    `,
  });
  const sky = new THREE.Points(geometry, material);
  sky.renderOrder = -2;
  scene.add(sky);
}
