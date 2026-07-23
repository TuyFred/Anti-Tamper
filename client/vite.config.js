import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'leaflet';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('socket.io-client')) return 'socket';
          if (id.includes('lucide-react')) return 'icons';
          if (
            id.includes('react-dom')
            || id.includes('react-router')
            || id.includes('/react/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
