/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Link previews need absolute URLs (og:image in particular); the deploy workflow
// sets SITE_URL to the published address. Ends with a slash.
const siteUrl = (process.env.SITE_URL || 'http://localhost:5173/').replace(/\/?$/, '/')

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH. Local dev stays at /.
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'tripsplit-site-url',
      // Before Vite's own %ENV% replacement, which would warn about an unknown variable.
      transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', siteUrl) },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely — keep it in separately cached chunks.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            // Only the Analytics tab loads this.
            { name: 'charts', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|es-toolkit)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
