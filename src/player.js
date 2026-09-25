/* player.js — كاميرا منظور أول + WASD + Pointer Lock + تصادم (مدرسة مصغّرة) */
import * as THREE from 'three';

// الحدود الخارجية الصلبة للمدرسة كاملة (الفصل + الممر + القاعة + الفناء)
const SCHOOL_BOUNDS = { minX: -9.6, maxX: 11.6, minZ: -3.6, maxZ: 19.1 };

export class Player {
  constructor(camera, domElement, colliders) {
    this.camera = camera;
    this.dom = domElement;
    this.colliders = colliders;

    this.yaw = 0; // البداية: جلوس والنظر نحو السبورة/مقدمة الفصل (-Z)
    this.pitch = 0;
    this.keys = {};
    this.locked = false;
    this.eyeHeight = 1.2; // ارتفاع الكاميرا لوضعية الجلوس خلف الطاولة (1.15–1.25م)
    this.radius = 0.35;
    this.speed = 3.0;

    camera.rotation.order = 'YXZ';
    // نقطة البداية: جالس على كرسي خلف طاولة دراسية (الصف الخلفي، عمود أيمن)
    // الكرسي عند (2.05, 2.15) — خارج صندوق تصادم الطاولة، والنظر نحو السبورة
    camera.position.set(2.05, this.eyeHeight, 2.15);
    this.applyRotation();

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom || document.pointerLockElement === document.body;
    });
  }

  requestLock() {
    // Pointer Lock يجب أن يُطلب من عنصر في DOM بعد gesture من المستخدم
    const el = this.dom;
    if (document.pointerLockElement) return;
    try {
      const p = el.requestPointerLock?.();
      // بعض المتصفحات تُرجع Promise قد تُرفض إذا استُدعيت بسرعة — تجاهلها بهدوء
      if (p && p.catch) p.catch(() => {});
    } catch { /* تجاهل */ }
  }

  onMouseMove(e) {
    if (!this.locked) return;
    const sens = 0.0022;
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    this.applyRotation();
  }

  applyRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  get position() { return this.camera.position; }

  update(dt) {
    const f = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0);
    const r = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
    if (f === 0 && r === 0) return;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // أمام الكاميرا على مستوى الأرض
    const fwd = new THREE.Vector3(-sin, 0, -cos);
    const right = new THREE.Vector3(cos, 0, -sin);
    const move = new THREE.Vector3()
      .addScaledVector(fwd, f)
      .addScaledVector(right, r);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.speed * dt);

    const next = this.camera.position.clone().add(move);
    this.resolveCollision(next);
    this.camera.position.copy(next);
    this.camera.position.y = this.eyeHeight; // ثبات الارتفاع
  }

  resolveCollision(p) {
    // 1) الحدود الخارجية للمدرسة (ارتداد داخلي مع هامش نصف القطر)
    p.x = Math.max(SCHOOL_BOUNDS.minX + this.radius, Math.min(SCHOOL_BOUNDS.maxX - this.radius, p.x));
    p.z = Math.max(SCHOOL_BOUNDS.minZ + this.radius, Math.min(SCHOOL_BOUNDS.maxZ - this.radius, p.z));
    // 2) الطاولات + الجدران (AABB): دفع الدائرة خارج الصندوق — عدة تمريرات للزوايا
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        const nx = Math.max(c.minX, Math.min(c.maxX, p.x));
        const nz = Math.max(c.minZ, Math.min(c.maxZ, p.z));
        const dx = p.x - nx, dz = p.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < this.radius * this.radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            p.x = nx + (dx / d) * this.radius;
            p.z = nz + (dz / d) * this.radius;
          } else {
            // المركز داخل الصندوق: ادفعه من أقرب حافة
            const pushL = p.x - c.minX, pushR = c.maxX - p.x;
            const pushB = p.z - c.minZ, pushF = c.maxZ - p.z;
            const m = Math.min(pushL, pushR, pushB, pushF);
            if (m === pushL) p.x = c.minX - this.radius;
            else if (m === pushR) p.x = c.maxX + this.radius;
            else if (m === pushB) p.z = c.minZ - this.radius;
            else p.z = c.maxZ + this.radius;
          }
        }
      }
    }
  }
}
