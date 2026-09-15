import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { validateProductionConfig } from './src/lib/productionConfig.js'

export default defineConfig(({ command, mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  if (command === 'build') validateProductionConfig(environment)
  return {
    base: process.env.GITHUB_ACTIONS ? '/Tu-hogar-CR/' : '/',
    plugins: [react()],
  }
})
