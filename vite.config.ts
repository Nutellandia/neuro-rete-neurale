import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Necessario per WebGPU e Top-level await
    outDir: 'dist'
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'] // Evita problemi di ottimizzazione con Wasm
  }
})