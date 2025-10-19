/* eslint-env node */
import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // host: '0.0.0.0', // habilite para acessar pela rede
    port: Number(process.env.VITE_PORT || 5173),
  },
})
