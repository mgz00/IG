// El plano fija carriles de caída; la altura final la resuelven gravedad y contactos.
export const DURATION = 20000;
export const BUILD_END = 14;
export const STEP = 1 / 120;
export const CHILD_SCALE = 0.4;
export const CHILD_ORIGIN = [0, 0.28, -4.3];
export const SPECS = [];
const add = spec => SPECS.push({ mass: 1.5, ...spec });
add({ kind: 'base', size: [14, 0.4, 18], position: [0, 0, 0], drop: 2.2, release: 0.4, mass: 80, color: 0x398d65 });
for (let row = 0; row < 8; row++) {
  let order = 0;
  const y = 0.2 + row * 0.8 + 0.4;
  const release = () => 1.5 + row * 0.9 + order++ * 0.012;
  const color = row === 0 || row === 4 ? 0x3679ad : row % 2 ? 0xf1c94b : 0xe6b83f;
  for (const x of [-6.5, 6.5]) for (let z = -8; z <= 8; z += 2) {
    // Una pieza de ventana sustituye dos hiladas y sigue siendo un cuerpo rígido.
    if (row === 3 && z === 0) continue;
    const window = row === 2 && z === 0;
    add({ kind: window ? 'window' : 'brick', size: [1, window ? 1.6 : 0.8, 2],
      position: [x, y + (window ? 0.4 : 0), z], release: release(), drop: 3.5, color: window ? 0x378cbd : color });
  }
  for (const x of [-5, -3, -1, 1, 3, 5]) {
    add({ kind: 'brick', size: [2, 0.8, 1], position: [x, y, -8.5], release: release(), drop: 3.5, color });
    if (row < 5 && Math.abs(x) < 2) continue;
    if (row === 5 && Math.abs(x) < 4) continue;
    add({ kind: 'brick', size: [2, 0.8, 1], position: [x, y, 8.5], release: release(), drop: 3.5, color });
  }
  if (row === 5) add({ kind: 'lintel', size: [8, 0.8, 1], position: [0, y, 8.5], release: release(), drop: 3.5, color: 0x3679ad, mass: 5 });
}
// Placas que apoyan en los muros y forman un tejado escalonado.
for (let i = 0; i < 7; i++) add({ kind: 'roof', size: [2, 0.4, 18], position: [-6 + i * 2, 6.8, 0],
  release: 9.2 + i * 0.035, drop: 3, color: 0xc34239, mass: 4 });
for (let i = 0; i < 4; i++) add({ kind: 'roof', size: [12 - i * 2, 0.4, 16 - i * 2],
  position: [0, 7.2 + i * 0.4, 0], release: 10.3 + i * 0.75, drop: 3, color: i % 2 ? 0xd14d3f : 0xc34239, mass: 8 });
