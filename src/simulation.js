/* simulation.js — تسلسل المحاكاة: هدوء 5s → إنذار + إضاءة حمراء → مراقبة خمول 10s → أسهم → خروج */
import * as THREE from 'three';
import { layoutArrows } from './scene.js';

const AUDIO_SRC = 'assets/audio/fire-alarm.mp3';
const SUCCESS_SRC = 'assets/audio/success.mp3';

export class Simulation {
  constructor({ sceneData, player, ui }) {
    this.sceneData = sceneData;
    this.player = player;
    this.ui = ui;

    this.state = 'idle'; // idle | calm | alarm | done
    this.calmTimer = 0;
    this.alarmTime = 0;
    this.alarmBlend = 0; // 0 طبيعي → 1 تحذيري (انتقال تدريجي)
    this.inactivityTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.arrowsShown = false;
    this.audio = null;
    this.audioOk = false;
    this.oscFallback = null; // مولد صوت بديل إذا غاب ملف mp3
    // ألوان مؤقتة للتلميح التحذيري الخفيف (بصري فقط — التوقيت والمنطق ثابتان)
    this._cWhite = new THREE.Color(0xffffff);
    this._cTint = new THREE.Color(0xffcfc6);
  }

  start() {
    this.state = 'calm';
    this.calmTimer = 5; // هدوء 5 ثوانٍ
    this.alarmTime = 0;
    this.alarmBlend = 0;
    this.inactivityTimer = 0;
    this.arrowsShown = false;
    this.lastPos.copy(this.player.position);
    this.ui.showHint('أنت داخل الفصل… انتظر', 5000);
    console.log('[sim] بدأت التجربة: هدوء لمدة 5 ثوانٍ');
  }

  // --- الصوت: حمّل mp3 وإلا حذّر وواصل مع بديل WebAudio ---
  ensureAudio() {
    if (this.audio || this.oscFallback) return;
    try {
      const a = new Audio(AUDIO_SRC);
      a.loop = true;
      a.volume = 1.0;
      a.addEventListener('error', () => {
        console.warn(`[sim] Warning: ملف الصوت غير موجود: ${AUDIO_SRC} — سيستمر التشغيل بدون ملف MP3 (بديل WebAudio).`);
        this.startOscFallback(1.0);
      });
      a.play().then(() => {
        this.audioOk = true;
        console.log('[sim] يعمل صوت الإنذار من ملف MP3');
      }).catch(() => {
        console.warn(`[sim] Warning: تعذّر تشغيل ${AUDIO_SRC} تلقائيًا — استخدام بديل WebAudio.`);
        this.startOscFallback(1.0);
      });
      this.audio = a;
    } catch (err) {
      console.warn(`[sim] Warning: تعذّر إنشاء عنصر الصوت (${AUDIO_SRC}):`, err);
      this.startOscFallback(1.0);
    }
  }

  // بديل: صفارة إنذار ثنائية النغمة عبر WebAudio (لا يحتاج ملفات)
  startOscFallback(volume = 1.0) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this._actx) this._actx = new Ctx();
      const ctx = this._actx;
      if (ctx.state === 'suspended') ctx.resume();
      this.stopOscFallback();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 660;
      gain.gain.value = 0.06 * volume;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      // تناوب النغمة 660 ↔ 520 كل 0.5 ثانية (صوت إنذار كلاسيكي)
      let hi = true;
      const iv = setInterval(() => {
        hi = !hi;
        try { osc.frequency.value = hi ? 660 : 520; } catch { /* ignore */ }
      }, 500);
      this.oscFallback = { osc, gain, iv };
      console.log('[sim] يعمل الإنذار البديل (WebAudio oscillator)');
    } catch (err) {
      console.warn('[sim] Warning: تعذّر تشغيل الإنذار البديل:', err);
    }
  }

  setAlarmVolume(v) {
    // يُطبَّق دائمًا على عنصر الصوت (حتى لو لم يكتمل التحميل بعد)،
    // حتى يعمل خفض الـ 50% عند الخمول حتى مع تأخر بدء التشغيل
    if (this.audio) {
      try { this.audio.volume = v; } catch { /* ignore */ }
    }
    if (this.oscFallback) {
      try { this.oscFallback.gain.gain.value = 0.06 * v; } catch { /* ignore */ }
    }
  }

  stopAlarmSound() {
    try { this.audio?.pause(); } catch { /* ignore */ }
    this.stopOscFallback();
  }

  stopOscFallback() {
    if (!this.oscFallback) return;
    try {
      clearInterval(this.oscFallback.iv);
      this.oscFallback.osc.stop();
      this.oscFallback.osc.disconnect();
    } catch { /* ignore */ }
    this.oscFallback = null;
  }

  triggerAlarm() {
    this.state = 'alarm';
    this.alarmTime = 0;
    this.inactivityTimer = 0;
    this.lastPos.copy(this.player.position);
    console.log('[sim] بدأ إنذار الحريق!');
    this.ensureAudio();
    this.ui.showHint('إنذار حريق! توجه فورًا إلى باب الخروج', 5000);
  }

  showArrows() {
    this.arrowsShown = true;
    this.setAlarmVolume(0.5); // خفض الصوت إلى 50%
    layoutArrows(this.sceneData.arrowsGroup, this.player.position, this.sceneData.exitPos);
    this.ui.showHint('اتبع الأسهم الخضراء نحو باب الخروج', 6000);
    console.log('[sim] المستخدم لم يتحرك 10 ثوانٍ: خفض الصوت 50% + إظهار الأسهم');
  }

  evacuate() {
    if (this.state === 'done') return;
    this.state = 'done';
    this.stopAlarmSound(); // إيقاف إنذار الحريق فورًا عند الوصول للباب
    this.playSuccessSound(); // صوت نجاح هادئ مرة واحدة (بدون Loop)
    this.sceneData.arrowsGroup.visible = false;
    console.log('[sim] تم الإخلاء بنجاح');
    this.ui.showSuccess();
  }

  // --- صوت النجاح: ملف success.mp3 مرة واحدة، أو رنين WebAudio بسيط كبديل ---
  playSuccessSound() {
    try {
      const a = new Audio(SUCCESS_SRC);
      a.loop = false;
      a.volume = 0.5; // هادئ وواضح وغير مزعج
      a.addEventListener('error', () => {
        console.warn(`[sim] Warning: ملف صوت النجاح غير موجود: ${SUCCESS_SRC} — استخدام رنين WebAudio بديل.`);
        this.playSuccessChimeFallback();
      });
      a.play().then(() => {
        console.log('[sim] يعمل صوت النجاح من ملف MP3');
      }).catch(() => {
        console.warn(`[sim] Warning: تعذّر تشغيل ${SUCCESS_SRC} تلقائيًا — استخدام رنين WebAudio بديل.`);
        this.playSuccessChimeFallback();
      });
    } catch (err) {
      console.warn(`[sim] Warning: تعذّر إنشاء صوت النجاح (${SUCCESS_SRC}):`, err);
      this.playSuccessChimeFallback();
    }
  }

  // بديل: رنين نجاح قصير (3 نغمات صاعدة) عبر WebAudio — مرة واحدة فقط
  playSuccessChimeFallback() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this._actx) this._actx = new Ctx();
      const ctx = this._actx;
      if (ctx.state === 'suspended') ctx.resume();
      const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = ctx.currentTime + i * 0.18;
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.55);
      });
      console.log('[sim] يعمل رنين النجاح البديل (WebAudio)');
    } catch (err) {
      console.warn('[sim] Warning: تعذّر تشغيل رنين النجاح البديل:', err);
    }
  }

  update(dt) {
    const L = this.sceneData.lights;

    if (this.state === 'calm') {
      this.calmTimer -= dt;
      if (this.calmTimer <= 0) this.triggerAlarm();
    }

    if (this.state === 'alarm') {
      this.alarmTime += dt;
      // انتقال تدريجي لطابع تحذيري خفيف خلال ~3 ثوانٍ (نفس التوقيت — قيم أخف فقط)
      // التفاصيل تبقى مرئية: الإضاءة الدافئة لا تنخفض كثيرًا، والأحمر وميض موضعي
      this.alarmBlend = Math.min(1, this.alarmBlend + dt / 3);
      const flicker = 0.75 + 0.25 * Math.sin(this.alarmTime * 8);
      for (const w of L.warningLights) w.intensity = 5 * this.alarmBlend * flicker;
      for (const w of L.warmLights) w.intensity = 9 * (1 - 0.3 * this.alarmBlend);
      L.ambient.intensity = 0.32 - 0.06 * this.alarmBlend;
      L.ambient.color.copy(this._cWhite).lerp(this._cTint, this.alarmBlend * 0.35);
      // منارة الإنذار فوق الباب: وميض أحمر موضعي فقط
      if (L.beaconLight) L.beaconLight.intensity = 6 * this.alarmBlend * (0.35 + 0.65 * Math.max(0, Math.sin(this.alarmTime * 6)));
      if (L.beaconMat) L.beaconMat.emissiveIntensity = 0.15 + 2.2 * this.alarmBlend * (0.35 + 0.65 * Math.max(0, Math.sin(this.alarmTime * 6)));

      // مراقبة الحركة: تحرك > 0.4 م يعيد ضبط المؤقت
      const moved = this.player.position.distanceTo(this.lastPos);
      if (moved > 0.4) {
        this.inactivityTimer = 0;
        this.lastPos.copy(this.player.position);
      } else {
        this.inactivityTimer += dt;
      }
      if (!this.arrowsShown && this.inactivityTimer >= 10) this.showArrows();

      // كشف الوصول إلى منطقة الخروج
      const p = this.player.position;
      if (this.sceneData.triggerBox.containsPoint(new THREE.Vector3(p.x, 1, p.z))) {
        this.evacuate();
      }
    }

    if (this.state === 'done') {
      // إعادة الإضاءة تدريجيًا إلى الطبيعي
      this.alarmBlend = Math.max(0, this.alarmBlend - dt / 1.5);
      for (const w of L.warningLights) w.intensity = 5 * this.alarmBlend;
      for (const w of L.warmLights) w.intensity = 9 * (1 - 0.3 * this.alarmBlend);
      L.ambient.intensity = 0.32 - 0.06 * this.alarmBlend;
      L.ambient.color.copy(this._cWhite).lerp(this._cTint, this.alarmBlend * 0.35);
      if (L.beaconLight) L.beaconLight.intensity = 6 * this.alarmBlend;
      if (L.beaconMat) L.beaconMat.emissiveIntensity = 0.15 + 2.2 * this.alarmBlend;
    }
  }
}
