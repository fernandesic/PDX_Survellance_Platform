/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api/v1': {
        target: 'https://api.whonghub.org',
        changeOrigin: true,
      },
      '/proxy/reliefweb': {
        target: 'https://api.reliefweb.int',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/reliefweb/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Removed manualChunks to avoid Uncaught TypeError: Cannot read properties of undefined (reading 'forwardRef')
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    include: ['lucide-react']
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
  },
})

