/* scene.js — مدرسة مصغّرة: فصل + ممر + قاعة خروج + فناء خارجي
 * البنية مهيأة لاحقًا لـ WebXR (إضافة VRButton و Teleportation دون تغيير المشهد)
 * مسار الإخلاء: مقعد الطالب → باب الفصل → الممر شرقًا → قاعة الخروج جنوبًا → الفناء الخارجي
 * خفيف: BoxGeometry + CanvasTexture فقط، بدون موديلات خارجية.
 */
import * as THREE from 'three';

// أبعاد الفصل (بالمتر) — ثابتة (نقطة البداية داخلها)
export const ROOM = { w: 12, d: 8, h: 3.2, wall: 0.2 };
// باب الفصل (على الجدار الجنوبي z = +d/2) — مخرج وسيط، لا يُنهي التجربة
export const EXIT = { x: 0, z: ROOM.d / 2, width: 1.6, height: 2.3 };
// الممر المدرسي أمام الفصل (يمتد شرقًا وغربًا)
export const CORRIDOR = { minX: -10, maxX: 10, minZ: 4.2, maxZ: 7.0, h: 3.2 };
// قاعة الخروج الشرقية (من الممر جنوبًا حتى باب المبنى الرئيسي)
export const HALL = { minX: 7, maxX: 10, minZ: 7.0, maxZ: 14.0, h: 3.2 };
// المخرج النهائي للمبنى (باب رئيسي على الجدار الجنوبي للقاعة)
export const FINAL_EXIT = { x: 8.5, z: 14.0, width: 1.8, height: 2.4 };
// الفناء الخارجي الآمن (منطقة التجمع)
export const YARD = { minX: 5, maxX: 12, minZ: 14.2, maxZ: 19.5 };

// خط السير الثابت للإخلاء (يُستخدم لرسم الأسهم واختبارات الحركة)
export const EVAC_ROUTE = [
  { x: 0, z: 2.5 },    // الممر الأوسط داخل الفصل
  { x: 0, z: 4.0 },    // باب الفصل
  { x: 0, z: 5.6 },    // مدخل الممر
  { x: 8.5, z: 5.6 },  // التحرك شرقًا في الممر
  { x: 8.5, z: 13.8 }, // النزول جنوبًا في قاعة الخروج
  { x: 8.5, z: 16.6 }, // خارج المبنى — منطقة التجمع
];

export function buildClassroom(scene) {
  const colliders = []; // عوائق AABB على مستوى الأرض: {minX,maxX,minZ,maxZ}
  const group = new THREE.Group();
  scene.add(group);
  const details = {}; // عناصر متحركة (عقرب الساعة، لمبة الكاشف)

  // ---------- مواد أساسية هادئة ----------
  const matWall = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.96 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0xd3dce3, roughness: 0.96 }); // جدار مميز غربي
  const matCeil = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 1 });
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.6, metalness: 0.3 });
  const matAlu = new THREE.MeshStandardMaterial({ color: 0xb9bfc4, roughness: 0.35, metalness: 0.7 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.3, metalness: 0.8 });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.5 });

  // ---------- أرضية: بلاط فينيل فاتح (CanvasTexture إجرائية، بدون ملفات) ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.75 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  // ---------- سقف ----------
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), matCeil);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.h;
  group.add(ceil);

  const T = ROOM.wall;
  const H = ROOM.h;

  function addBox(w, h, d, mat, x, y, z, parent = group) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // ---------- الجدران ----------
  const northZ = -ROOM.d / 2 - T / 2;
  const southZ = ROOM.d / 2 + T / 2;
  addBox(ROOM.w + T * 2, H, T, matWall, 0, H / 2, northZ).receiveShadow = true; // شمالي
  addBox(T, H, ROOM.d, matWall, ROOM.w / 2 + T / 2, H / 2, 0); // شرقي (نوافذ)
  addBox(T, H, ROOM.d, matAccent, -ROOM.w / 2 - T / 2, H / 2, 0); // غربي مميز

  // الجنوبي (باب الخروج): يسار + يمين + عتبة — نفس الفتحة تمامًا
  const doorW = EXIT.width;
  const doorH = EXIT.height;
  const sideW = (ROOM.w + T * 2 - doorW) / 2;
  addBox(sideW, H, T, matWall, EXIT.x - doorW / 2 - sideW / 2, H / 2, southZ);
  addBox(sideW, H, T, matWall, EXIT.x + doorW / 2 + sideW / 2, H / 2, southZ);
  addBox(doorW, H - doorH, T, matWall, EXIT.x, doorH + (H - doorH) / 2, southZ);

  // ---------- وزرات (Baseboards) ----------
  const matBase = new THREE.MeshStandardMaterial({ color: 0x6f7479, roughness: 0.6 });
  addBox(ROOM.w, 0.09, 0.03, matBase, 0, 0.045, -ROOM.d / 2 + 0.015);
  addBox(0.03, 0.09, ROOM.d, matBase, ROOM.w / 2 - 0.015, 0.045, 0);
  addBox(0.03, 0.09, ROOM.d, matBase, -ROOM.w / 2 + 0.015, 0.045, 0);

  // ---------- نوافذ الجدار الشرقي (3 نوافذ بإطارات بيضاء) ----------
  const matFrame = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.5 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0xcfe4ef, roughness: 0.1, metalness: 0.1,
    emissive: 0xbdd9e8, emissiveIntensity: 0.35 // توهج نهاري خفيف
  });
  for (const wz of [-2.3, 0, 2.3]) {
    const win = new THREE.Group();
    win.position.set(ROOM.w / 2 - 0.02, 1.75, wz);
    // إطار خارجي
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 2.0), matFrame);
    win.add(fr);
    // زجاج
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), matGlass);
    gl.rotation.y = -Math.PI / 2;
    gl.position.x = -0.055;
    win.add(gl);
    // قواطع (mullions)
    const mv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), matFrame);
    mv.position.x = -0.06;
    win.add(mv);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.8), matFrame);
    mh.position.x = -0.06;
    win.add(mh);
    // عتبة
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 2.1), matFrame);
    sill.position.set(-0.05, -0.8, 0);
    win.add(sill);
    group.add(win);
  }

  // ---------- سبورة بيضاء حديثة + كتابة خطة الإخلاء ----------
  const boardW = 4.2, boardH = 1.3, boardY = 1.7, boardZ = -ROOM.d / 2 + 0.1;
  addBox(boardW + 0.16, boardH + 0.16, 0.05, matAlu, 0, boardY, boardZ - 0.02);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardW, boardH, 0.06),
    new THREE.MeshStandardMaterial({ map: makeWhiteboardTexture(), roughness: 0.18 })
  );
  board.position.set(0, boardY, boardZ);
  group.add(board);
  addBox(boardW, 0.05, 0.16, matAlu, 0, boardY - boardH / 2 - 0.06, boardZ + 0.08); // رف
  // قلمان + ممحاة
  const matMarkerB = new THREE.MeshStandardMaterial({ color: 0x2456c8 });
  const matMarkerR = new THREE.MeshStandardMaterial({ color: 0xc8283c });
  addBox(0.14, 0.025, 0.025, matMarkerB, -0.5, boardY - boardH / 2 - 0.02, boardZ + 0.08);
  addBox(0.14, 0.025, 0.025, matMarkerR, -0.3, boardY - boardH / 2 - 0.02, boardZ + 0.08);
  addBox(0.13, 0.04, 0.05, new THREE.MeshStandardMaterial({ color: 0x333333 }), 0.4, boardY - boardH / 2 - 0.015, boardZ + 0.08);

  // ---------- ساعة حائط (عقرب ثوانٍ متحرك) ----------
  {
    const clock = new THREE.Group();
    clock.position.set(0, 2.62, -ROOM.d / 2 + 0.06);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    clock.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.23, 32),
      new THREE.MeshBasicMaterial({ map: makeClockTexture() }));
    face.position.z = 0.028;
    clock.add(face);
    const handMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const hourH = new THREE.Group(), minH = new THREE.Group(), secH = new THREE.Group();
    const hg = new THREE.BoxGeometry(0.02, 0.1, 0.005); hg.translate(0, 0.04, 0);
    const mg = new THREE.BoxGeometry(0.014, 0.16, 0.005); mg.translate(0, 0.07, 0);
    const sg = new THREE.BoxGeometry(0.006, 0.18, 0.004); sg.translate(0, 0.07, 0);
    hourH.add(new THREE.Mesh(hg, handMat));
    minH.add(new THREE.Mesh(mg, handMat));
    secH.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xc8283c })));
    hourH.position.z = 0.032; minH.position.z = 0.035; secH.position.z = 0.038;
    hourH.rotation.z = -2.1; minH.rotation.z = 0.6; // وقت ثابت تقريبي
    clock.add(hourH, minH, secH);
    group.add(clock);
    details.secondHand = secH;
  }

  // ---------- بوسترات توعوية (غربي) ----------
  const poster1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2),
    new THREE.MeshStandardMaterial({ map: makePosterTexture('السلامة أولاً', 'اعرف مخارج الطوارئ', '#b97a1a', '#fff7e6'), roughness: 0.9 }));
  poster1.rotation.y = Math.PI / 2;
  poster1.position.set(-ROOM.w / 2 + 0.03, 1.8, -1.6);
  group.add(poster1);
  const poster2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2),
    new THREE.MeshStandardMaterial({ map: makePosterTexture('هدوء • نظام', 'اتبع الأسهم الخضراء', '#1f6f8b', '#eaf6fb'), roughness: 0.9 }));
  poster2.rotation.y = Math.PI / 2;
  poster2.position.set(-ROOM.w / 2 + 0.03, 1.8, 0.1);
  group.add(poster2);

  // ---------- خزانة منخفضة + نبتة (غربي، داخل هامش الجدار) ----------
  const matCab = new THREE.MeshStandardMaterial({ color: 0xd9d2c2, roughness: 0.7 });
  addBox(0.4, 0.8, 2.2, matCab, -ROOM.w / 2 + 0.25, 0.4, 2.6);
  addBox(0.02, 0.6, 0.03, matTrim, -ROOM.w / 2 + 0.46, 0.4, 2.6); // فاصل أبواب
  // نبتة
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: 0xa9603c, roughness: 0.8 }));
  pot.position.set(-ROOM.w / 2 + 0.25, 0.92, 2.2);
  pot.castShadow = true;
  group.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e8e4f, roughness: 0.9 });
  for (const [ly, s] of [[1.25, 0.22], [1.45, 0.17]]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMat);
    leaf.position.set(-ROOM.w / 2 + 0.25, ly, 2.2);
    leaf.castShadow = true;
    group.add(leaf);
  }

  // ---------- مكتب المعلم + كرسي + كتب ----------
  {
    const matTopT = new THREE.MeshStandardMaterial({ color: 0xcdb894, roughness: 0.55 });
    const matSideT = new THREE.MeshStandardMaterial({ color: 0x8a7a5f, roughness: 0.7 });
    const tx = -3.8, tz = -2.9;
    addBox(1.6, 0.06, 0.7, matTopT, tx, 0.74, tz).castShadow = true;
    addBox(0.06, 0.71, 0.65, matSideT, tx - 0.75, 0.36, tz);
    addBox(0.06, 0.71, 0.65, matSideT, tx + 0.75, 0.36, tz);
    addBox(1.44, 0.5, 0.04, matSideT, tx, 0.45, tz - 0.3); // واجهة
    // كرسي المعلم
    const matOff = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 });
    addBox(0.48, 0.06, 0.48, matOff, tx, 0.48, tz - 0.85).castShadow = true;
    addBox(0.48, 0.6, 0.06, matOff, tx, 0.8, tz - 1.06);
    // رزمة كتب
    const bookCols = [0xc84b4b, 0x3b6ea5, 0x3fa06a];
    bookCols.forEach((c, i) => {
      addBox(0.32 - i * 0.03, 0.045, 0.24, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
        tx + 0.45, 0.795 + i * 0.047, tz + 0.1);
    });
    colliders.push({ minX: tx - 0.95, maxX: tx + 0.95, minZ: tz - 1.15, maxZ: tz + 0.5 });
  }

  // ---------- طاولات الطلاب + كراسي (نفس التوزيع السابق، تصميم أحدث) ----------
  const matDeskTop = new THREE.MeshStandardMaterial({ color: 0xe3e7ea, roughness: 0.4 });
  const matDeskEdge = new THREE.MeshStandardMaterial({ color: 0x2f7fa3, roughness: 0.5 });
  const matLeg = new THREE.MeshStandardMaterial({ color: 0xaab2b8, roughness: 0.3, metalness: 0.75 });
  const matSeat = new THREE.MeshStandardMaterial({ color: 0x35a3b8, roughness: 0.55 });
  const rows = [-1.9, -0.4, 1.1];
  const cols = [-3.6, -2.0, 2.0, 3.6]; // الوسط فارغ كممر إخلاء
  for (const rz of rows) {
    for (const cxd of cols) {
      addModernDesk(group, cxd, rz, matDeskTop, matDeskEdge, matLeg, matSeat);
      colliders.push({ minX: cxd - 0.75, maxX: cxd + 0.75, minZ: rz - 0.55, maxZ: rz + 0.55 });
    }
  }

  // ---------- لوحة مدرسية + قواعد الفصل على الجدار الجنوبي (بجانب الباب) ----------
  // مستويات خفيفة فقط — تُرى لحظة التوجه للخروج وتعزز إحساس المدرسة
  {
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42),
      new THREE.MeshStandardMaterial({ map: makeLabelTexture('مدرسة المستقبل • فصل 3-ب', '#1f6f8b'), roughness: 0.9 }));
    plaque.rotation.y = Math.PI; // نحو داخل الفصل
    plaque.position.set(2.9, 2.0, ROOM.d / 2 - 0.015);
    group.add(plaque);
    const rules = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2),
      new THREE.MeshStandardMaterial({ map: makePosterTexture('قواعد الفصل', 'الهدوء وقت الطوارئ', '#3f6b3a', '#f2f8f0'), roughness: 0.9 }));
    rules.rotation.y = Math.PI;
    rules.position.set(-3.0, 1.8, ROOM.d / 2 - 0.015);
    group.add(rules);
  }

  // ---------- حقائب مدرسية بسيطة تحت بعض الطاولات (بصري فقط) ----------
  // داخل بصمة تصادم الطاولات الحالية — لا عوائق جديدة ولا تأثير على المسار
  {
    const packCols = [0xb03a48, 0x2f6db0, 0x3f8e5a];
    const packSpots = [[-3.6, -1.9], [-2.0, 1.1], [3.6, -0.4]];
    packSpots.forEach(([px, pz], i) => {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.2),
        new THREE.MeshStandardMaterial({ color: packCols[i % 3], roughness: 0.85 }));
      pack.position.set(px - 0.3, 0.21, pz - 0.1);
      pack.rotation.y = 0.15 * (i - 1);
      group.add(pack);
    });
  }

  // ---------- مصابيح سقف LED (6 ألواح) ----------
  const lampMeshes = [];
  const panelFrame = new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.5 });
  for (const lx of [-2.5, 2.5]) {
    for (const lz of [-2.5, 0, 2.5]) {
      addBox(1.3, 0.07, 0.45, panelFrame, lx, ROOM.h - 0.035, lz);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36),
        new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xfff3da, emissiveIntensity: 1.0, roughness: 0.4
        }));
      panel.rotation.x = Math.PI / 2;
      panel.position.set(lx, ROOM.h - 0.075, lz);
      group.add(panel);
      lampMeshes.push(panel);
    }
  }

  // ---------- كاشف دخان في السقف + لمبة حمراء تومض ----------
  {
    const det = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 20), matWhite);
    det.position.set(0, ROOM.h - 0.03, 0.5);
    group.add(det);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 1 }));
    led.position.set(0.05, ROOM.h - 0.055, 0.5);
    group.add(led);
    details.smokeLed = led;
  }

  // ---------- طفاية حريق بجانب الباب + لافتة ----------
  {
    const fx = 1.9, fz = ROOM.d / 2 - 0.18;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.48, 20),
      new THREE.MeshStandardMaterial({ color: 0xc0272d, roughness: 0.35, metalness: 0.2 }));
    body.position.set(fx, 0.95, fz);
    body.castShadow = true;
    group.add(body);
    addBox(0.05, 0.06, 0.05, matSteel, fx, 1.22, fz); // صمام
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
    hose.position.set(fx + 0.07, 1.12, fz);
    hose.rotation.z = 0.5;
    group.add(hose);
    addBox(0.16, 0.05, 0.04, matSteel, fx, 1.26, fz); // مقبض
    addBox(0.2, 0.06, 0.12, matSteel, fx, 0.62, fz + 0.02); // حامل
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture('طفاية حريق', '#c0272d') }));
    sign.position.set(fx, 1.55, fz - 0.09);
    sign.rotation.y = Math.PI;
    group.add(sign);
  }

  // ---------- باب طوارئ: إطار ألمنيوم + دفة خضراء + بار دفع + لافتة EXIT ----------
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x6d747a, roughness: 0.4, metalness: 0.6 });
  const frameT = 0.12;
  for (const sx of [-1, 1]) {
    addBox(frameT, doorH, 0.34, frameMat, EXIT.x + sx * (doorW / 2), doorH / 2, ROOM.d / 2);
  }
  addBox(doorW + 0.24, frameT, 0.34, frameMat, EXIT.x, doorH + frameT / 2, ROOM.d / 2);
  // عتبة معدنية
  addBox(doorW, 0.03, 0.34, matSteel, EXIT.x, 0.015, ROOM.d / 2);

  // الدفة (مفتوحة بزاوية)
  {
    const leaf = new THREE.Group();
    const matLeaf = new THREE.MeshStandardMaterial({ color: 0x4e8f6b, roughness: 0.5, metalness: 0.15 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.12, doorH - 0.06, 0.07), matLeaf);
    slab.castShadow = true;
    leaf.add(slab);
    // نافذة رؤية عمودية
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1d2b33, roughness: 0.1, metalness: 0.4 }));
    win.position.set(-0.35, 0.4, 0);
    leaf.add(win);
    // بار الدفع + لوحة ركل
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.09), matSteel);
    bar.position.set(0, 0.05, -0.08);
    leaf.add(bar);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.2, 0.3, 0.075), matSteel);
    kick.position.set(0, -doorH / 2 + 0.25, 0);
    leaf.add(kick);
    leaf.position.set(EXIT.x + doorW / 2 - 0.06, doorH / 2, ROOM.d / 2 + 0.42);
    leaf.rotation.y = -Math.PI / 3;
    group.add(leaf);
  }

  // لافتة خروج مضيئة وأنيقة فوق الباب (داخل)
  const exitSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.36, 0.09),
    new THREE.MeshStandardMaterial({
      map: makeExitTexture(), emissive: 0xffffff, emissiveMap: makeExitTexture(),
      emissiveIntensity: 0.55, roughness: 0.4
    })
  );
  exitSign.position.set(EXIT.x, doorH + 0.32, ROOM.d / 2 - 0.08);
  group.add(exitSign);

  // جرس/منارة إنذار فوق الباب (وميض أحمر خفيف وقت الإنذار فقط)
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x7a1414, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.3
  });
  addBox(0.16, 0.1, 0.1, matWhite, EXIT.x - 0.85, doorH + 0.32, ROOM.d / 2 - 0.1);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), beaconMat);
  beacon.rotation.x = Math.PI; // القبة للأسفل
  beacon.position.set(EXIT.x - 0.85, doorH + 0.27, ROOM.d / 2 - 0.1);
  group.add(beacon);

  // ---------- عتبة باب الفصل: سجادة صغيرة (ممر فقط — ليست منطقة نجاح) ----------
  {
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.9 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(EXIT.x, 0.012, ROOM.d / 2 + 0.7);
    group.add(mat);
  }

  // =====================================================
  // المدرسة المصغّرة: ممر + قاعة خروج + مخرج نهائي + فناء
  // =====================================================
  const matFloorC = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.8 });
  const matFloorH = new THREE.MeshStandardMaterial({ color: 0xd7d3c8, roughness: 0.8 });
  const matYard = new THREE.MeshStandardMaterial({ color: 0xb9c9ae, roughness: 1 });
  const matDoorFake = new THREE.MeshStandardMaterial({ color: 0x9db3a8, roughness: 0.6 });
  const matGlassD = new THREE.MeshStandardMaterial({
    color: 0xcfe4ef, roughness: 0.1, metalness: 0.2,
    emissive: 0xbfd9e8, emissiveIntensity: 0.25
  });

  // أرضيات الممر والقاعة والفناء (خفيفة — مستويات فقط)
  function addFloor(w, d, mat, x, z, y = 0.005) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, y, z);
    f.receiveShadow = true;
    group.add(f);
    return f;
  }
  const corrW = CORRIDOR.maxX - CORRIDOR.minX;
  const corrD = CORRIDOR.maxZ - CORRIDOR.minZ;
  const corrCx = (CORRIDOR.minX + CORRIDOR.maxX) / 2;
  const corrCz = (CORRIDOR.minZ + CORRIDOR.maxZ) / 2;
  addFloor(corrW, corrD, matFloorC, corrCx, corrCz);
  // شريط أوسط بلون مختلف يقود بصريًا نحو الشرق (طريق الإخلاء)
  addFloor(corrW, 0.9, new THREE.MeshStandardMaterial({ color: 0xb9c6a8, roughness: 0.85 }), corrCx, corrCz, 0.008);
  const hallW = HALL.maxX - HALL.minX;
  const hallD = HALL.maxZ - HALL.minZ;
  const hallCx = (HALL.minX + HALL.maxX) / 2;
  const hallCz = (HALL.minZ + HALL.maxZ) / 2;
  addFloor(hallW, hallD, matFloorH, hallCx, hallCz);
  const yardW = YARD.maxX - YARD.minX;
  const yardD = YARD.maxZ - YARD.minZ;
  addFloor(yardW, yardD, matYard, (YARD.minX + YARD.maxX) / 2, (YARD.minZ + YARD.maxZ) / 2, 0.004);

  // أسقف الممر والقاعة (نفس ارتفاع الفصل)
  const Hc = CORRIDOR.h;
  function addCeil(w, d, x, z) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matCeil);
    c.rotation.x = Math.PI / 2;
    c.position.set(x, Hc, z);
    group.add(c);
  }
  addCeil(corrW, corrD, corrCx, corrCz);
  addCeil(hallW, hallD, hallCx, hallCz);

  const WT = 0.2; // سماكة الجدران
  // جدران الممر الشمالية (امتداد لجدار الفصل الجنوبي، مع فجوة باب الفصل فقط)
  addBox((CORRIDOR.minX * -1 - ROOM.w / 2) + 0, Hc, WT, matWall, (CORRIDOR.minX + -ROOM.w / 2) / 2, Hc / 2, CORRIDOR.minZ - WT / 2);
  addBox((CORRIDOR.maxX - ROOM.w / 2), Hc, WT, matWall, (ROOM.w / 2 + CORRIDOR.maxX) / 2, Hc / 2, CORRIDOR.minZ - WT / 2);
  // الجدار الجنوبي للممر (مع فتحة دخول قاعة الخروج عند x ∈ [7,10])
  addBox((HALL.minX - CORRIDOR.minX), Hc, WT, matWall, (CORRIDOR.minX + HALL.minX) / 2, Hc / 2, CORRIDOR.maxZ + WT / 2);
  // نهايتا الممر غربًا وشرقًا
  addBox(WT, Hc, corrD + WT, matWall, CORRIDOR.minX - WT / 2, Hc / 2, corrCz);
  addBox(WT, Hc, corrD + WT, matWall, CORRIDOR.maxX + WT / 2, Hc / 2, corrCz);
  // جدران قاعة الخروج (غربي + شرقي)
  addBox(WT, Hc, hallD, matWall, HALL.minX - WT / 2, Hc / 2, hallCz);
  addBox(WT, Hc, hallD, matWall, HALL.maxX + WT / 2, Hc / 2, hallCz);
  // الجدار الجنوبي للقاعة (باب المبنى الرئيسي في المنتصف)
  {
    const fw = FINAL_EXIT.width;
    const segL = (FINAL_EXIT.x - fw / 2) - (HALL.minX - WT / 2);
    const segR = (HALL.maxX + WT / 2) - (FINAL_EXIT.x + fw / 2);
    addBox(segL, Hc, WT, matWall, (HALL.minX - WT / 2 + FINAL_EXIT.x - fw / 2) / 2, Hc / 2, HALL.maxZ + WT / 2);
    addBox(segR, Hc, WT, matWall, (FINAL_EXIT.x + fw / 2 + HALL.maxX + WT / 2) / 2, Hc / 2, HALL.maxZ + WT / 2);
    addBox(fw, Hc - FINAL_EXIT.height, WT, matWall, FINAL_EXIT.x, FINAL_EXIT.height + (Hc - FINAL_EXIT.height) / 2, HALL.maxZ + WT / 2);
  }
  // سياج الفناء الخارجي (منخفض حتى تبقى السماء مرئية)
  {
    const fy = 1.1;
    addBox(0.15, fy, yardD, matWall, YARD.minX - 0.07, fy / 2, (YARD.minZ + YARD.maxZ) / 2);
    addBox(0.15, fy, yardD, matWall, YARD.maxX + 0.07, fy / 2, (YARD.minZ + YARD.maxZ) / 2);
    addBox(yardW + 0.3, fy, 0.15, matWall, (YARD.minX + YARD.maxX) / 2, fy / 2, YARD.maxZ + 0.07);
  }

  // أبواب فصول أخرى (ديكورية — مغلقة على امتداد الممر)
  function fakeDoor(x, z, ry) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), matDoorFake);
    slab.position.y = 1.1;
    g.add(slab);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.1), matGlassD);
    win.position.set(-0.25, 1.5, 0);
    g.add(win);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.22),
      new THREE.MeshStandardMaterial({ map: makeLabelTexture('فصل • CLASS', '#5a6d80'), roughness: 0.9 }));
    plate.position.set(0, 2.45, 0.06);
    g.add(plate);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
  }
  fakeDoor(-7.5, CORRIDOR.minZ - 0.05, Math.PI); // على الجدار الشمالي للممر
  fakeDoor(4.5, CORRIDOR.minZ - 0.05, Math.PI);
  fakeDoor(HALL.minX - 0.05, 10.0, Math.PI / 2); // على جدار القاعة الغربي

  // لافتات إرشادية في الممر والقاعة
  function wallSign(text, bg, w, h, x, y, z, ry) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture(text, bg) }));
    s.position.set(x, y, z);
    s.rotation.y = ry;
    group.add(s);
    return s;
  }
  // لافتة EXIT مضيئة فوق باب الفصل من جهة الممر
  const exitSignCorr = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.36, 0.09),
    new THREE.MeshStandardMaterial({
      map: makeExitTexture(), emissive: 0xffffff, emissiveMap: makeExitTexture(),
      emissiveIntensity: 0.55, roughness: 0.4
    })
  );
  exitSignCorr.position.set(EXIT.x, doorH + 0.32, ROOM.d / 2 + 0.28);
  exitSignCorr.rotation.y = Math.PI;
  group.add(exitSignCorr);
  wallSign('مخرج →', '#0b5c2c', 1.3, 0.34, 3.4, 2.3, CORRIDOR.maxZ - 0.09, Math.PI);
  wallSign('طريق الإخلاء', '#1f6f8b', 1.5, 0.36, -4.0, 2.3, CORRIDOR.maxZ - 0.09, Math.PI);
  wallSign('مخرج EXIT', '#0b5c2c', 1.4, 0.36, HALL.minX + 0.11, 2.3, 10.5, Math.PI / 2);
  // لافتة المخرج النهائي المضيئة فوق باب المبنى (من الداخل والخارج)
  const finalSignIn = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.4, 0.1),
    new THREE.MeshStandardMaterial({
      map: makeExitTexture(), emissive: 0xffffff, emissiveMap: makeExitTexture(),
      emissiveIntensity: 0.6, roughness: 0.4
    })
  );
  finalSignIn.position.set(FINAL_EXIT.x, FINAL_EXIT.height + 0.35, HALL.maxZ - 0.1);
  finalSignIn.rotation.y = Math.PI;
  group.add(finalSignIn);
  const finalSignOut = finalSignIn.clone();
  finalSignOut.position.set(FINAL_EXIT.x, FINAL_EXIT.height + 0.35, HALL.maxZ + 0.32);
  finalSignOut.rotation.y = 0;
  group.add(finalSignOut);

  // باب المبنى الرئيسي النهائي (درفتان زجاجيتان مفتوحتان)
  {
    const matFrameD = new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.4, metalness: 0.6 });
    const fw = FINAL_EXIT.width, fh = FINAL_EXIT.height;
    addBox(0.12, fh, 0.3, matFrameD, FINAL_EXIT.x - fw / 2, fh / 2, HALL.maxZ + 0.1);
    addBox(0.12, fh, 0.3, matFrameD, FINAL_EXIT.x + fw / 2, fh / 2, HALL.maxZ + 0.1);
    addBox(fw + 0.24, 0.12, 0.3, matFrameD, FINAL_EXIT.x, fh + 0.06, HALL.maxZ + 0.1);
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(fw / 2 - 0.08, fh - 0.1, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x7fb3c8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 }));
      leaf.add(slab);
      leaf.position.set(FINAL_EXIT.x + sx * fw / 2, fh / 2, HALL.maxZ + 0.35);
      leaf.rotation.y = sx * Math.PI / 2.6;
      group.add(leaf);
    }
    addBox(fw, 0.03, 0.4, matSteel, FINAL_EXIT.x, 0.015, HALL.maxZ + 0.1); // عتبة
  }

  // طفاية حريق + جرس إنذار في الممر (بجانب قاعة الخروج)
  {
    const fx = 6.2, fz = CORRIDOR.maxZ - 0.2;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.48, 20),
      new THREE.MeshStandardMaterial({ color: 0xc0272d, roughness: 0.35, metalness: 0.2 }));
    body.position.set(fx, 0.95, fz);
    body.castShadow = true;
    group.add(body);
    addBox(0.05, 0.06, 0.05, matSteel, fx, 1.22, fz);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture('طفاية حريق', '#c0272d') }));
    sign.position.set(fx, 1.55, fz + 0.11);
    group.add(sign);
  }

  // منطقة التجمع الآمنة في الفناء الخارجي
  {
    const safe = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0),
      new THREE.MeshStandardMaterial({ color: 0xa9d6b8, roughness: 0.9 }));
    safe.rotation.x = -Math.PI / 2;
    safe.position.set(FINAL_EXIT.x, 0.012, FINAL_EXIT.z + 2.6);
    group.add(safe);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x2fa36b });
    const mkEdge = (w, d, x, z) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), edgeMat);
      e.position.set(x, 0.02, z);
      group.add(e);
    };
    mkEdge(3.4, 0.08, FINAL_EXIT.x, FINAL_EXIT.z + 1.14);
    mkEdge(3.4, 0.08, FINAL_EXIT.x, FINAL_EXIT.z + 4.06);
    mkEdge(0.08, 3.0, FINAL_EXIT.x - 1.66, FINAL_EXIT.z + 2.6);
    mkEdge(0.08, 3.0, FINAL_EXIT.x + 1.66, FINAL_EXIT.z + 2.6);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture('منطقة آمنة • SAFE', '#1e7a4c'), transparent: true }));
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(FINAL_EXIT.x, 0.025, FINAL_EXIT.z + 2.6);
    group.add(decal);
    const outLight = new THREE.PointLight(0xe2ffe9, 6, 9, 1.7);
    outLight.position.set(FINAL_EXIT.x, 2.5, FINAL_EXIT.z + 2.6);
    scene.add(outLight);
  }

  // عوائق التصادم للجدران الجديدة (AABB على مستوى الأرض)
  colliders.push({ minX: -10, maxX: -6, minZ: 3.9, maxZ: 4.3 });
  colliders.push({ minX: 6, maxX: 10, minZ: 3.9, maxZ: 4.3 });
  colliders.push({ minX: -6, maxX: -0.8, minZ: 3.9, maxZ: 4.3 });
  colliders.push({ minX: 0.8, maxX: 6, minZ: 3.9, maxZ: 4.3 });
  colliders.push({ minX: -10, maxX: 7, minZ: 6.9, maxZ: 7.3 });
  colliders.push({ minX: -10.2, maxX: -10, minZ: 4.0, maxZ: 7.2 });
  colliders.push({ minX: 10, maxX: 10.2, minZ: 4.0, maxZ: 7.2 });
  colliders.push({ minX: 6.8, maxX: 7.0, minZ: 7.0, maxZ: 14.2 });
  colliders.push({ minX: 10, maxX: 10.2, minZ: 7.0, maxZ: 14.2 });
  colliders.push({ minX: 6.8, maxX: 7.6, minZ: 13.9, maxZ: 14.3 });
  colliders.push({ minX: 9.4, maxX: 10.2, minZ: 13.9, maxZ: 14.3 });
  colliders.push({ minX: -6.2, maxX: -6, minZ: -4.2, maxZ: 4.2 });
  colliders.push({ minX: 6, maxX: 6.2, minZ: -4.2, maxZ: 4.2 });
  colliders.push({ minX: -6.2, maxX: 6.2, minZ: -4.4, maxZ: -4.0 });

  // ---------- إضاءة متوازنة ومريحة ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a917e, 0.55));
  const ambient = new THREE.AmbientLight(0xffffff, 0.32);
  scene.add(ambient);

  // ضوء نهاري من جهة النوافذ (ظل واحد فقط — خفيف على الأداء)
  const sun = new THREE.DirectionalLight(0xeef2ff, 1.1);
  sun.position.set(10, 6.5, 1.5);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // إضاءة سقف دافئة: الفصل (4 نقاط) + الممر (3) + القاعة (2) — بدون ظلال
  const warmLights = [];
  for (const [lx, lz] of [[-2.5, -1.8], [2.5, -1.8], [-2.5, 1.8], [2.5, 1.8]]) {
    const p = new THREE.PointLight(0xffe9c4, 9, 11, 1.8);
    p.position.set(lx, ROOM.h - 0.4, lz);
    scene.add(p);
    warmLights.push(p);
  }
  for (const [lx, lz] of [[-5, 5.6], [0, 5.6], [5, 5.6]]) {
    const p = new THREE.PointLight(0xfff1d6, 8, 10, 1.8);
    p.position.set(lx, Hc - 0.4, lz);
    scene.add(p);
    warmLights.push(p);
  }
  for (const [lx, lz] of [[8.5, 9.5], [8.5, 12.5]]) {
    const p = new THREE.PointLight(0xfff1d6, 8, 10, 1.8);
    p.position.set(lx, Hc - 0.4, lz);
    scene.add(p);
    warmLights.push(p);
  }

  // إضاءة تحذيرية حمراء خفيفة (مطفأة افتراضيًا — تُدار من simulation.js)
  const warningLights = [];
  for (const [lx, lz] of [[-2.5, 0.6], [2.5, 0.6], [0, 5.6], [8.5, 10.5]]) {
    const p = new THREE.PointLight(0xff2a1a, 0, 9, 1.7);
    p.position.set(lx, 2.1, lz); // منخفضة عن السقف حتى لا تُشبع السقف بالأحمر
    scene.add(p);
    warningLights.push(p);
  }

  // منارة الإنذار فوق الباب (وميض موضعي فقط)
  const beaconLight = new THREE.PointLight(0xff2a1a, 0, 5, 1.8);
  beaconLight.position.set(EXIT.x - 0.85, doorH + 0.1, ROOM.d / 2 - 0.4);
  scene.add(beaconLight);

  // إضاءة خضراء موضعية حول لافتة الخروج فقط
  const exitLight = new THREE.PointLight(0x39d97e, 2.2, 3.2, 1.8);
  exitLight.position.set(EXIT.x, doorH + 0.2, EXIT.z - 0.7);
  scene.add(exitLight);

  // ---------- الأسهم الإرشادية (مخفية) ----------
  const arrowsGroup = new THREE.Group();
  arrowsGroup.visible = false;
  scene.add(arrowsGroup);

  // صندوق الـ Trigger النهائي: عند المخرج الخارجي للمبنى فقط (النجاح هنا فقط)
  const triggerBox = new THREE.Box3(
    new THREE.Vector3(FINAL_EXIT.x - 1.2, 0, FINAL_EXIT.z + 0.1),
    new THREE.Vector3(FINAL_EXIT.x + 1.2, 2.5, FINAL_EXIT.z + 2.2)
  );
  const triggerHelper = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.06, 2.1),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.14 })
  );
  triggerHelper.position.set(FINAL_EXIT.x, 0.03, FINAL_EXIT.z + 1.15);
  triggerHelper.visible = false; // مساعد تصحيح فقط — مخفي في التجربة
  scene.add(triggerHelper);

  // Trigger وسيط عند باب الفصل: لتحديث الحالة فقط (لا يُنهي التجربة)
  const classDoorBox = new THREE.Box3(
    new THREE.Vector3(EXIT.x - 1.1, 0, EXIT.z - 1.6),
    new THREE.Vector3(EXIT.x + 1.1, 2.5, EXIT.z + 0.6)
  );

  return {
    group, colliders, arrowsGroup, triggerBox, triggerHelper, classDoorBox,
    lights: { ambient, warmLights, warningLights, exitLight, lampMeshes, beaconLight, beaconMat, sun },
    exitPos: new THREE.Vector3(FINAL_EXIT.x, 0, FINAL_EXIT.z + 2.6),
    classExitPos: new THREE.Vector3(EXIT.x, 0, EXIT.z),
    details
  };
}

// طاولة طالب حديثة + كرسي (نفس البصمة السابقة)
function addModernDesk(group, x, z, matTop, matEdge, matLeg, matSeat) {
  const desk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.6), matTop);
  top.position.y = 0.74;
  top.castShadow = true;
  top.receiveShadow = true;
  desk.add(top);
  // حافة ملونة أمامية
  const edge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.03), matEdge);
  edge.position.set(0, 0.74, 0.3);
  desk.add(edge);
  // أرجل معدنية أسطوانية
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 10);
  for (const [lx, lz] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) {
    const leg = new THREE.Mesh(legGeo, matLeg);
    leg.position.set(lx, 0.36, lz);
    desk.add(leg);
  }
  // درج صغير تحت السطح
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xcfd6db, roughness: 0.6 }));
  drawer.position.set(0.25, 0.65, 0);
  desk.add(drawer);
  // كرسي: مقعد + ظهر مائل قليلًا + أرجل
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.42), matSeat);
  seat.position.y = 0.45;
  seat.castShadow = true;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), matSeat);
  back.position.set(0, 0.72, 0.22);
  back.rotation.x = 0.1;
  chair.add(back);
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8), matLeg);
    leg.position.set(lx, 0.225, lz);
    chair.add(leg);
  }
  chair.position.set(0.05, 0, 1.05);
  chair.rotation.y = 0; // ثابتة نحو الطاولة (وضعية جلوس نظامية)
  desk.add(chair);
  // كتاب على الطاولة
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x7a9cc6, roughness: 0.8 }));
  book.position.set(-0.25, 0.79, 0.05);
  book.rotation.y = 0.3;
  desk.add(book);
  desk.position.set(x, 0, z);
  group.add(desk);
}

// ---- مسار الإخلاء الكامل: من موقع اللاعب عبر باب الفصل والممر حتى الفناء ----
// يبني قائمة نقاط تبدأ من موقع اللاعب الحالي ثم أقرب نقطة أمامية في EVAC_ROUTE
export function getEvacPath(fromPos) {
  const pts = EVAC_ROUTE.map((p) => new THREE.Vector3(p.x, 0, p.z));
  // أقرب نقطة في المسار لموقع اللاعب
  let best = 0, bestD = Infinity;
  pts.forEach((p, i) => {
    const d = (p.x - fromPos.x) ** 2 + (p.z - fromPos.z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  // إذا كان اللاعب قد تجاوز النقطة الأقرب فعليًا، ابدأ من التي بعدها
  let startIdx = best;
  if (best < pts.length - 1) {
    const a = pts[best], b = pts[best + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const apx = fromPos.x - a.x, apz = fromPos.z - a.z;
    const t = (apx * abx + apz * abz) / Math.max(1e-6, abx * abx + abz * abz);
    if (t > 0.9) startIdx = best + 1;
  }
  return [new THREE.Vector3(fromPos.x, 0, fromPos.z), ...pts.slice(startIdx)];
}

// ---- أسهم شيفرون على الأرض بطول المسار الكامل (الفصل → الممر → المخرج النهائي) ----
export function layoutArrows(arrowsGroup, fromPos, _toPos) {
  while (arrowsGroup.children.length) {
    const ch = arrowsGroup.children.pop();
    ch.traverse?.((o) => { if (o !== ch) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
    ch.geometry?.dispose?.(); ch.material?.dispose?.();
  }
  const path = getEvacPath(fromPos);
  // أطوال المقاطع
  const segLens = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x, dz = path[i + 1].z - path[i].z;
    const L = Math.hypot(dx, dz);
    segLens.push(L);
    total += L;
  }
  if (total < 0.5) { arrowsGroup.visible = false; return; }
  const SPACING = 1.4;
  const count = Math.max(4, Math.min(18, Math.floor(total / SPACING)));
  const geo = makeChevronGeometry(); // هندسة مشتركة
  let order = 0;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    let d = 1.0 + t * Math.max(0.5, total - 2.2); // من بعد اللاعب بقليل حتى قبل النهاية
    // حدد المقطع الذي تقع فيه المسافة d
    let acc = 0, si = 0;
    while (si < segLens.length - 1 && acc + segLens[si] < d) { acc += segLens[si]; si++; }
    const a = path[si], b = path[si + 1];
    const L = Math.max(1e-6, segLens[si]);
    const f = Math.min(1, Math.max(0, (d - acc) / L));
    const px = a.x + (b.x - a.x) * f;
    const pz = a.z + (b.z - a.z) * f;
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2fb872, transparent: true, opacity: 0.8, depthWrite: false
    });
    const arrow = new THREE.Mesh(geo, mat);
    arrow.rotation.x = -Math.PI / 2; // الاستلقاء على الأرض
    arrow.rotation.z = angle + Math.PI; // الشيفرون مرسوم للأعلى +Y
    arrow.position.set(px, 0.025, pz);
    arrow.userData.order = order++;
    arrowsGroup.add(arrow);
  }
  arrowsGroup.visible = true;
}

// شيفرون "∧" بعرض ~0.55م — يُرسم مشيرًا للأعلى (+Y) ثم يُسطَّح على الأرض
function makeChevronGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.30, -0.02);
  s.lineTo(0, 0.30);
  s.lineTo(0.30, -0.02);
  s.lineTo(0.19, -0.02);
  s.lineTo(0, 0.17);
  s.lineTo(-0.19, -0.02);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

// نبض + توهج متحرك باتجاه الباب — يُستدعى كل إطار
export function pulseArrows(arrowsGroup, elapsed) {
  if (!arrowsGroup.visible) return;
  const n = arrowsGroup.children.length;
  for (const a of arrowsGroup.children) {
    const i = a.userData.order || 0;
    // موجة ضوئية تسير من اللاعب نحو الباب
    const wave = 0.5 + 0.5 * Math.sin(elapsed * 3.2 - i * 0.85);
    a.material.opacity = 0.45 + 0.4 * wave;
    const sc = 1 + 0.09 * wave;
    a.scale.set(sc, sc, 1);
  }
}

// تفاصيل متحركة دائمًا: عقرب الثواني + لمبة كاشف الدخان
export function tickDetails(sceneData, elapsed) {
  const d = sceneData.details;
  if (d.secondHand) d.secondHand.rotation.z = -(elapsed % 60) / 60 * Math.PI * 2;
  if (d.smokeLed) d.smokeLed.material.emissiveIntensity = (Math.sin(elapsed * 2.4) > 0.4) ? 1.6 : 0.15;
}

// ---------- خامات إجرائية (Canvas) ----------

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// بلاط فينيل فاتح بفواصل خفيفة
function makeFloorTexture() {
  const tex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d9d2c4';
    g.fillRect(0, 0, 256, 256);
    // تنقيط خفيف
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(120,110,95,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // فواصل البلاط
    g.strokeStyle = '#b3aa97';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128);
    g.strokeRect(128, 128, 128, 128);
    g.strokeRect(128, 0, 128, 128);
    g.strokeRect(0, 128, 128, 128);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 8); // بلاطة ~0.5م
  return tex;
}

// سبورة بيضاء عليها خطة الإخلاء
function makeWhiteboardTexture() {
  return canvasTex(1024, 320, (g) => {
    g.fillStyle = '#fdfdfd';
    g.fillRect(0, 0, 1024, 320);
    g.fillStyle = '#1f6f8b';
    g.font = 'bold 54px Cairo, Arial';
    g.textAlign = 'center';
    g.fillText('خطة الإخلاء في حالات الحريق', 512, 80);
    g.strokeStyle = '#1f6f8b';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(232, 105); g.lineTo(792, 105); g.stroke();
    g.fillStyle = '#555555';
    g.font = '40px Cairo, Arial';
    g.fillText('1- حافظ على هدوئك   2- اتبع الأسهم الخضراء   3- توجه لباب الخروج', 512, 180);
    g.fillStyle = '#0a7a2f';
    g.font = 'bold 44px Cairo, Arial';
    g.fillText('نقطة التجمع: الساحة الخارجية', 512, 255);
    // سهم أخضر صغير
    g.fillStyle = '#0a7a2f';
    g.beginPath();
    g.moveTo(880, 230); g.lineTo(930, 255); g.lineTo(880, 280); g.lineTo(880, 265); g.lineTo(850, 265); g.lineTo(850, 245); g.lineTo(880, 245);
    g.closePath(); g.fill();
  });
}

// وجه الساعة
function makeClockTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222222';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const big = i % 3 === 0;
      g.save();
      g.translate(128, 128); g.rotate(a);
      g.fillRect(-(big ? 5 : 2.5), -118, big ? 10 : 5, big ? 26 : 14);
      g.restore();
    }
  });
}

// بوستر توعوي
function makePosterTexture(title, sub, bg, fg) {
  return canvasTex(360, 480, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 360, 480);
    g.fillStyle = fg;
    g.fillRect(18, 18, 324, 444);
    g.fillStyle = bg;
    g.font = 'bold 52px Cairo, Arial';
    g.textAlign = 'center';
    const words = title.split(' ');
    words.forEach((w, i) => g.fillText(w, 180, 150 + i * 62));
    g.font = '34px Cairo, Arial';
    g.fillText(sub, 180, 360);
  });
}

// لافتة نصية صغيرة بخلفية ملونة
function makeLabelTexture(text, bg) {
  return canvasTex(512, 128, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#ffffff';
    g.font = 'bold 56px Cairo, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
  });
}

// لافتة الخروج (تُستخدم كخريطة + خريطة توهج)
let _exitTexCache = null;
function makeExitTexture() {
  if (_exitTexCache) return _exitTexCache;
  _exitTexCache = canvasTex(512, 160, (g) => {
    g.fillStyle = '#0b5c2c';
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#eafff0';
    g.lineWidth = 8;
    g.strokeRect(10, 10, 492, 140);
    g.fillStyle = '#eafff0';
    g.font = 'bold 68px Cairo, Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('خروج EXIT', 256, 84);
  });
  return _exitTexCache;
}
