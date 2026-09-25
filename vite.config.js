import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false
  },
  // ملاحظة WebXR لاحقًا:
  // - سنضيف VRButton من three/addons عند تفعيل الواقع الافتراضي
  // - الإبقاء على renderer.xr.enabled = true حينها
});
