/* main.js — نقطة الدخول: Renderer + Loop (مهيأ لـ WebXR لاحقًا) */
import './styles.css';
import * as THREE from 'three';
import { buildClassroom, pulseArrows, tickDetails, getEvacPath } from './scene.js';
import { Player } from './player.js';
import { Simulation } from './simulation.js';
import { UI } from './ui.js';

const canvas = document.getElementById('scene-canvas');

// Renderer — إعدادات مناسبة للمتصفح + جاهزية WebXR مستقبلًا
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// للواقع الافتراضي لاحقًا:
// renderer.xr.enabled = false; // يُفعَّل عند إضافة VRButton + Meta Quest
// document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a5c4);
scene.fog = new THREE.Fog(0x87a5c4, 22, 60); // مدى أطول للمدرسة + الفناء الخارجي

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 100);

// بناء الفصل
const sceneData = buildClassroom(scene);

// اللاعب + المحاكاة + الواجهة
const player = new Player(camera, renderer.domElement, sceneData.colliders);
const ui = new UI();
const sim = new Simulation({ sceneData, player, ui });

// زر البدء: إخفاء الشاشة + Pointer Lock + بدء المحاكاة
ui.onStart(() => {
  ui.hideStart();
  player.requestLock();
  sim.start();
});
// إعادة التحميل لزر الإعادة
document.getElementById('restart-btn').addEventListener('click', () => window.location.reload());
// النقر على المشهد يعيد قفل المؤشر أثناء التجربة
renderer.domElement.addEventListener('click', () => {
  if (sim.state !== 'done' && sim.state !== 'idle') player.requestLock();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// حلقة الرسم
const clock = new THREE.Clock();
// خطاف اختبار dev-only عبر ?autotest=... (لا يؤثر على الاستخدام العادي)
// fast-evacuate / fast-arrows: تشغيل متزامن فوري (يعمل حتى في headless --dump-dom)
const autotest = new URLSearchParams(window.location.search).get('autotest');
if (autotest && autotest.startsWith('fast-')) {
  ui.hideStart();
  sim.start();
  const step = 1 / 60;
  const result = { alarmAt: -1, arrowsAt: -1, doneAt: -1, frames: 0 };
  for (let i = 0; i < 60 * 60 && sim.state !== 'done'; i++) {
    result.frames = i + 1;
    const t = (i + 1) * step;
    if (autotest === 'fast-evacuate' && sim.state === 'alarm') {
      // سير افتراضي على طول مسار الإخلاء الكامل (فصل → ممر → مخرج نهائي) بسرعة 3 م/ث
      const path = getEvacPath(player.position);
      const target = path.length > 1 ? path[1] : sceneData.exitPos;
      const p = player.position;
      const dx = target.x - p.x, dz = target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const s = Math.min(d, 3.0 * step);
        p.x += (dx / d) * s; p.z += (dz / d) * s;
      }
    }
    sim.update(step);
    if (sim.state === 'alarm' && result.alarmAt < 0) result.alarmAt = t;
    if (sim.arrowsShown && result.arrowsAt < 0) result.arrowsAt = t;
  }
  if (sim.state === 'done') result.doneAt = result.frames * step;
  result.state = sim.state;
  result.arrows = sceneData.arrowsGroup.visible;
  const div = document.createElement('div');
  div.id = 'autotest-result';
  div.textContent = JSON.stringify(result);
  document.body.appendChild(div);
  console.log('[autotest-result] ' + JSON.stringify(result));
} else if (autotest) {
  console.log(`[autotest] وضع الاختبار: ${autotest}`);
  ui.hideStart();
  sim.start();
}
let autotestTeleported = false;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (sim.state === 'calm' || sim.state === 'alarm' || sim.state === 'done') {
    if (autotest === 'evacuate' && sim.state === 'alarm' && !autotestTeleported) {
      // محاكاة سير المستخدم على طول مسار الإخلاء: خطوات نحو النقطة التالية
      const path = getEvacPath(player.position);
      const target = path.length > 1 ? path[1] : sceneData.exitPos;
      const p = player.position;
      const dir = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
      if (player.position.distanceTo(sceneData.exitPos) < 1.2) {
        autotestTeleported = true;
        p.x = sceneData.exitPos.x; p.z = sceneData.exitPos.z;
      } else if (dir.length() > 0.05) {
        dir.normalize().multiplyScalar(Math.min(dir.length(), 3.0 * dt));
        p.x += dir.x; p.z += dir.z;
      }
    }
    player.update(dt);
    sim.update(dt);
  }
  pulseArrows(sceneData.arrowsGroup, elapsed);
  tickDetails(sceneData, elapsed); // ساعة الحائط + لمبة كاشف الدخان
  // حالة مرئية في DOM للفحص الآلي (وأدوات التصحيح)
  document.body.dataset.simState = sim.state;
  document.body.dataset.arrows = String(sceneData.arrowsGroup.visible);
  renderer.render(scene, camera);
}
animate();

// للاختبار من Console: window.__sim.state, window.__player.position
window.__sim = sim;
window.__player = player;
window.__sceneData = sceneData;
console.log('[app] جاهز — اضغط "ابدأ التجربة"');
