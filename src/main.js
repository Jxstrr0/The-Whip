// Boot: stage 0 placeholder, a slowly rotating desk under soft light.
import * as THREE from 'three';

const TITLE = 'The Whip';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#14171c');

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.6, 4);
camera.lookAt(0, 0.4, 0);

scene.add(new THREE.HemisphereLight('#fff4e0', '#203040', 1.2));
const key = new THREE.DirectionalLight('#ffffff', 1.4);
key.position.set(2, 4, 3);
scene.add(key);

// A desk: an oak lid on green leather, roughly a paired Commons desk.
const desk = new THREE.Group();
const oak = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.7 });
const leather = new THREE.MeshStandardMaterial({ color: '#2f5a3c', roughness: 0.9 });
const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.6), oak);
body.position.y = 0.35;
const lid = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.05, 0.66), leather);
lid.position.y = 0.72;
desk.add(body, lid);
scene.add(desk);

const ui = document.getElementById('ui');
ui.innerHTML = `<div class="title">${TITLE}<small>Dominion of Caledor · House of Commons</small></div>`;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Portrait screens are narrow, so pull back until the whole desk fits.
  camera.position.z = camera.aspect < 1 ? 4 / camera.aspect : 4;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  desk.rotation.y = t * 0.0003;
  renderer.render(scene, camera);
});
