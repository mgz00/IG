import * as THREE from '../vendor/three.module.js';
import { SPECS } from './blueprint.js';

export function createHouse() {
  const root = new THREE.Group(), materials = new Map();
  const studGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.12, 16);
  const matrix = new THREE.Matrix4();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.02 }));
    return materials.get(color);
  }
  const pieces = SPECS.map(spec => {
    const group = new THREE.Group(); group.visible = false; root.add(group);
    const [w, h, d] = spec.size, mat = material(spec.color);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.035, h - 0.025, d - 0.035), mat);
    group.add(body);
    const cols = Math.round(w), rows = Math.round(d);
    const studs = new THREE.InstancedMesh(studGeometry, mat, cols * rows);
    let n = 0;
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      matrix.makeTranslation(x - (cols - 1) / 2, h / 2 + 0.045, z - (rows - 1) / 2);
      studs.setMatrixAt(n++, matrix);
    }
    group.add(studs);
    if (spec.kind === 'window') {
      // Ventana oscura opaca: conserva el cierre visual del interior recursivo.
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h - 0.27, d - 0.3), material(0x1c485b));
      group.add(pane);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.09, d - 0.25), mat); group.add(bar);
    }
    return group;
  });
  // Láminas interiores tapan solo las juntas visuales entre cajas. Se activan
  // cuando el montaje ha terminado; evitan ver la madre por una rendija al entrar.
  const liners = new THREE.Group(); liners.visible = false; root.add(liners);
  for (const x of [-6.55, 6.55]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 6.4, 18), material(0xbe982f)); pane.position.set(x, 3.4, 0); liners.add(pane);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(12.1, 6.4, 0.03), material(0xbe982f)); back.position.set(0, 3.4, -8.55); liners.add(back);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(14, 0.03, 18), material(0x922b28)); ceiling.position.y = 6.82; liners.add(ceiling);
  function sync(poses, closeSeams = false) {
    liners.visible = closeSeams;
    pieces.forEach((piece, i) => {
      piece.visible = poses[i].visible;
      if (piece.visible) { piece.position.fromArray(poses[i].position); piece.quaternion.fromArray(poses[i].quaternion); }
    });
  }
  return { root, sync };
}
