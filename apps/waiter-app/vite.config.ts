import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'waiter-dev-csp',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>\s*/, '')
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
  },
  preview: {
    port: 4174,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
