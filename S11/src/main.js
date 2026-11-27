import * as THREE from '../vendor/three.module.js';
import * as TWEEN from '../vendor/tween.esm.js';
import { createBuildPhysics } from './physics.js';
import { createHouse } from './house.js';
import { frameCamera } from './camera.js';
import { DURATION, BUILD_END, CHILD_SCALE, CHILD_ORIGIN } from './blueprint.js';

const viewport = document.getElementById('viewport'), status = document.getElementById('status');
const author = document.getElementById('watermark').textContent;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0x27394c); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
viewport.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdceaff, 0x6b684e, 2.2));
const light = new THREE.DirectionalLight(0xffecd5, 3); light.position.set(-3, 9, 6); scene.add(light);
const fill = new THREE.DirectionalLight(0xcce7ff, 1.3); fill.position.set(8, 4, -9); scene.add(fill);
const camera = new THREE.PerspectiveCamera(66, 1, 0.025, 100);
let physics;
try { physics = createBuildPhysics(await window.Ammo()); }
catch (error) { status.textContent = 'No se pudo iniciar Ammo.js. Recarga la página.'; throw error; }
const parent = createHouse(), child = createHouse(); scene.add(parent.root, child.root);
child.root.position.set(...CHILD_ORIGIN); child.root.scale.setScalar(CHILD_SCALE);
// La madre usa el estado asentado de la misma simulación, sin alturas inventadas.
const completed = structuredClone(physics.seek(BUILD_END)); parent.sync(completed, true); physics.reset();
status.hidden = true;
let time = 0, last = performance.now(), paused = false, aspect = 1;
let tweenGroup, cameraState, previousLocal = -1;
function resetCameraTween() {
  tweenGroup = new TWEEN.Group(); cameraState = { progress: 0 };
  new TWEEN.Tween(cameraState, tweenGroup).to({ progress: 1 }, 5000).easing(TWEEN.Easing.Quintic.InOut).start(14000);
}
resetCameraTween();
let recorder = null, recordCanvas, recordContext, elapsed = 0, interrupted = false, downloadURL;
function resize() {
  if (recorder) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  aspect = viewport.clientWidth / viewport.clientHeight;
}
addEventListener('resize', resize); resize();
function frame(local) {
  if (local < previousLocal) resetCameraTween(); previousLocal = local; tweenGroup.update(local);
  child.sync(physics.seek(local / 1000), local >= 14000);
  frameCamera(camera, cameraState.progress, aspect); renderer.render(scene, camera);
}
function restart() { time = 0; last = performance.now(); physics.reset(); resetCameraTween(); previousLocal = -1; frame(0); }
addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || recorder) return;
  if (event.code === 'Space') { event.preventDefault(); paused = !paused; last = performance.now(); }
  if (event.key.toLowerCase() === 'r') restart();
  if (event.key.toLowerCase() === 'g') record();
  if (paused && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); time = Math.max(0, time + (event.key === 'ArrowRight' ? 500 : -500)); frame(time % DURATION);
  }
});
function recordFrame() {
  recordContext.drawImage(renderer.domElement, 0, 0);
  recordContext.save(); recordContext.globalAlpha = 0.55; recordContext.fillStyle = '#fff';
  recordContext.font = '18px Arial'; recordContext.textAlign = 'right';
  recordContext.shadowColor = '#000'; recordContext.shadowBlur = 3;
  recordContext.fillText(author, 1896, 1056); recordContext.restore();
}
function record() {
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => window.MediaRecorder?.isTypeSupported(type));
  if (!mimeType || !renderer.domElement.captureStream) { status.hidden = false; status.textContent = 'Este navegador no admite grabación WebM.'; return; }
  recordCanvas = document.createElement('canvas'); recordCanvas.width = 1920; recordCanvas.height = 1080;
  recordContext = recordCanvas.getContext('2d'); const stream = recordCanvas.captureStream(30), chunks = [];
  try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10000000 }); }
  catch { stream.getTracks().forEach(t => t.stop()); status.hidden = false; status.textContent = 'No se pudo iniciar la grabación.'; return; }
  paused = false; elapsed = 0; interrupted = false; status.hidden = true;
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = () => { interrupted = true; };
  recorder.onstop = () => {
    stream.getTracks().forEach(track => track.stop());
    if (!interrupted) {
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      const link = document.getElementById('video-download') || document.createElement('a');
      link.id = 'video-download'; link.hidden = true; link.href = downloadURL; link.download = 'casa-bloques-ammo-marcos-gonzalez-gomez.webm';
      document.body.appendChild(link); link.click();
    } else { status.hidden = false; status.textContent = 'Captura interrumpida. Mantén visible la pestaña y pulsa G para repetir.'; }
    recorder = null; recordCanvas = null; resize();
  };
  restart(); renderer.setPixelRatio(1); renderer.setSize(1920, 1080, false); aspect = 16 / 9;
  frame(0); recordFrame(); recorder.start(); last = performance.now();
}
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden && recorder?.state === 'recording') { interrupted = true; recorder.stop(); }
});
function loop(now) {
  requestAnimationFrame(loop); const delta = Math.max(0, now - last); last = now;
  if (!document.hidden && !paused) time += delta;
  frame(time % DURATION);
  if (recorder?.state === 'recording') { recordFrame(); elapsed += delta; if (elapsed >= DURATION) recorder.stop(); }
}
frame(0); requestAnimationFrame(loop);
addEventListener('pagehide', event => { if (!event.persisted) physics.dispose(); });
