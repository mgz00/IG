import * as THREE from '../vendor/three.module.js';
import { CHILD_ORIGIN, CHILD_SCALE } from './blueprint.js';
const eye = new THREE.Vector3(0, 2.6, 7), target = new THREE.Vector3(0, 2.6, -4);
const origin = new THREE.Vector3(...CHILD_ORIGIN), look = new THREE.Vector3();
export function frameCamera(camera, progress, aspect) {
  const scale = THREE.MathUtils.lerp(1, CHILD_SCALE, progress);
  camera.position.copy(eye).multiplyScalar(scale).addScaledVector(origin, progress);
  camera.lookAt(look.copy(target).multiplyScalar(scale).addScaledVector(origin, progress));
  camera.aspect = aspect; camera.fov = aspect < 1 ? 85 : 66;
  camera.near = 0.025 * scale; camera.far = 100 * scale;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
