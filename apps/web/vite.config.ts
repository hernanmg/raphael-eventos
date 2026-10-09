import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // En producción la API se sirve en el MISMO origen (rewrite /api/* de
        // vercel.json → Render). Sin esto, el service worker respondería
        // index.html a las navegaciones a /api/... (descargas de contratos,
        // exportaciones Excel/CSV) en vez de dejarlas llegar a la API.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Raphael Eventos',
        short_name: 'Raphael Eventos',
        description: 'Portal de clientes y panel administrador de Raphael Eventos',
        theme_color: '#141414',
        background_color: '#f7f5f0',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
