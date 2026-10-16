import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En desarrollo, /api/... se reenvía al backend. Así front y API comparten origen (como en
    // producción con Vercel) y las cookies de sesión funcionan sin configurar CORS.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
