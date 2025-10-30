import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { webcrypto } from 'node:crypto';

// Ensure Vite has access to a standards-compliant Web Crypto implementation when running
// in Node environments that expose `globalThis.crypto` without `getRandomValues`.
// This mirrors the browser API and prevents startup failures when dependencies rely
// on `crypto.getRandomValues` during dev server initialization (e.g. on older Node
// versions or restricted runtimes).
if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto as Crypto,
    configurable: true,
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      cors: {
        origin: env.VITE_IFRAME_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? true,
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  };
});
