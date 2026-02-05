import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const hudCard = document.querySelector('.card');
const startBtn = document.getElementById('startBtn');
const stats = document.getElementById('stats');
const keysLabel = document.getElementById('keys');
const priceLabel = document.getElementById('price');
const statusLabel = document.getElementById('status');
const hint = document.getElementById('centerHint');
const toast = document.getElementById('toast');

let keysFound = 0;
let satoshiUnlocked = false;
const keysGoal = 3;
let canInteract = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#040611');
scene.fog = new THREE.Fog('#040611', 10, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 2.1, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight('#69a5ff', '#120618', 0.7);
scene.add(hemi);

const neon = new THREE.PointLight('#47bfff', 22, 140);
neon.position.set(0, 22, 0);
scene.add(neon);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(280, 280),
  new THREE.MeshStandardMaterial({ color: '#101728', roughness: 0.95, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(280, 70, '#2088ff', '#142648');
scene.add(grid);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const move = { f: false, b: false, l: false, r: false, sprint: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

function makeBuilding(x, z, h, c = '#151c34') {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(8, h, 8),
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.2 })
  );
  b.position.set(x, h / 2, z);
  scene.add(b);
}

for (let i = -4; i <= 4; i++) {
  for (let j = -4; j <= 4; j++) {
    if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;
    const h = 6 + ((i * i + j * j) % 13);
    makeBuilding(i * 15, j * 15, h, i % 2 ? '#162c52' : '#291b45');
  }
}

const dataStations = [];
function makeStation(x, z, id) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 2.5, 18),
    new THREE.MeshStandardMaterial({ color: '#1f314f', emissive: '#0f2755', emissiveIntensity: 0.8 })
  );
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.15, 12, 32),
    new THREE.MeshStandardMaterial({ color: '#66d8ff', emissive: '#2ec8ff', emissiveIntensity: 2 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.4;
  g.add(body, halo);
  g.position.set(x, 1.25, z);
  g.userData = { type: 'station', id, collected: false };
  scene.add(g);
  dataStations.push(g);
}

makeStation(20, 6, 1);
makeStation(-24, -10, 2);
makeStation(8, -28, 3);

const satoshi = new THREE.Group();
const satoshiBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.8, 2.1, 8, 12),
  new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#7d5e1f', emissiveIntensity: 0.7 })
);
satoshiBody.position.y = 2;
const satoshiHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.62, 20, 20),
  new THREE.MeshStandardMaterial({ color: '#ffe3aa' })
);
satoshiHead.position.y = 3.7;
satoshi.add(satoshiBody, satoshiHead);
satoshi.position.set(-32, 0, 28);
satoshi.visible = false;
satoshi.userData = { type: 'satoshi' };
scene.add(satoshi);

function showToast(message, timeout = 2200) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), timeout);
}

function updateHint(target) {
  canInteract = target;
  hint.classList.toggle('hidden', !target);
}

function collectStation(station) {
  station.userData.collected = true;
  station.children[0].material.emissiveIntensity = 0.1;
  station.children[1].material.emissiveIntensity = 0.25;
  keysFound += 1;
  keysLabel.textContent = `کلیدها: ${keysFound}/${keysGoal}`;
  showToast(`کلید #${keysFound} دریافت شد. رد ساتوشی واضح‌تر شد.`);
  if (keysFound === keysGoal) {
    satoshiUnlocked = true;
    satoshi.visible = true;
    statusLabel.textContent = 'وضعیت: ساتوشی در منطقه شمال‌شرقی شناسایی شد!';
    showToast('همه کلیدها کامل شد! حالا به ساتوشی نزدیک شو.', 3000);
  }
}

function interact() {
  if (!canInteract) return;
  if (canInteract.userData.type === 'station' && !canInteract.userData.collected) {
    collectStation(canInteract);
  } else if (canInteract.userData.type === 'satoshi' && satoshiUnlocked) {
    statusLabel.textContent = 'وضعیت: ماموریت موفق. ساتوشی پیدا شد!';
    showToast('تبریک! تو ساتوشی را پیدا کردی و به راز بلاک جنسیس رسیدی.', 6000);
  }
}

function setupPriceFeed() {
  let last = 67000;
  priceLabel.textContent = `BTC: $${last.toLocaleString()}`;
  try {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (!data.p) return;
      const price = Number(data.p);
      if (Number.isFinite(price)) {
        last = price;
        priceLabel.textContent = `BTC: $${Math.round(last).toLocaleString()}`;
      }
    };
    ws.onclose = () => {
      priceLabel.textContent = 'BTC: قطع شد، حالت شبیه‌سازی فعال';
    };
  } catch {
    setInterval(() => {
      last += (Math.random() - 0.5) * 240;
      priceLabel.textContent = `BTC: ~$${Math.round(last).toLocaleString()}`;
    }, 1500);
  }
}

function checkInteraction() {
  const origin = controls.getObject().position.clone();
  raycaster.set(origin, camera.getWorldDirection(new THREE.Vector3()));
  const objects = [...dataStations.filter((d) => !d.userData.collected), satoshi].filter((o) =>
    o.visible !== false
  );
  const intersects = raycaster.intersectObjects(objects, true);
  if (!intersects.length) {
    updateHint(null);
    return;
  }
  const root = intersects[0].object.parent;
  const distance = intersects[0].distance;
  if (distance < 4.5) updateHint(root);
  else updateHint(null);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (controls.isLocked) {
    const speed = move.sprint ? 16 : 9;
    velocity.x -= velocity.x * 9 * dt;
    velocity.z -= velocity.z * 9 * dt;

    direction.z = Number(move.f) - Number(move.b);
    direction.x = Number(move.r) - Number(move.l);
    direction.normalize();

    if (move.f || move.b) velocity.z -= direction.z * speed * dt * 12;
    if (move.l || move.r) velocity.x -= direction.x * speed * dt * 12;

    controls.moveRight(-velocity.x * dt);
    controls.moveForward(-velocity.z * dt);

    const p = controls.getObject().position;
    p.y = 2.1;
    p.x = THREE.MathUtils.clamp(p.x, -130, 130);
    p.z = THREE.MathUtils.clamp(p.z, -130, 130);

    satoshi.rotation.y += dt;
    checkInteraction();
  }

  renderer.render(scene, camera);
}

startBtn.addEventListener('click', () => {
  controls.lock();
  hudCard.classList.add('hidden');
  stats.classList.remove('hidden');
  setupPriceFeed();
  showToast('وارد شهر نئون شدی. ایستگاه‌های درخشان را پیدا کن.');
});

controls.addEventListener('unlock', () => {
  hudCard.classList.remove('hidden');
  stats.classList.add('hidden');
  hint.classList.add('hidden');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') move.f = true;
  if (e.code === 'KeyS') move.b = true;
  if (e.code === 'KeyA') move.l = true;
  if (e.code === 'KeyD') move.r = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') move.sprint = true;
  if (e.code === 'KeyE') interact();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') move.f = false;
  if (e.code === 'KeyS') move.b = false;
  if (e.code === 'KeyA') move.l = false;
  if (e.code === 'KeyD') move.r = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') move.sprint = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
