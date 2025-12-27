/* eslint-env node */
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const d3ScaleDist = fileURLToPath(new URL('./node_modules/d3-scale/dist/d3-scale.js', import.meta.url))
const d3ShapeDist = fileURLToPath(new URL('./node_modules/d3-shape/dist/d3-shape.js', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Workaround: evita ler arquivos "src" corrompidos em alguns ambientes Windows.
    alias: {
      'd3-scale': d3ScaleDist,
      'd3-shape': d3ShapeDist,
    },
  },
  server: {
    // host: '0.0.0.0', // habilite para acessar pela rede
    port: Number(process.env.VITE_PORT || 5173),
    watch: {
      ignored: [
        '**/SupabaseBackup/**',
        '**/node_modules_old/**',
        // Evita erro UNKNOWN lstat em pasta corrompida que nao usamos mais.
        '**/Acidentes/HhtMensal/**',
        '**/Acidentes/HHTMEN~1/**',
        path.resolve(fileURLToPath(new URL('./src/components/Acidentes/HhtMensal', import.meta.url))),
      ],
    }
  }
})
