import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The FastAPI backend runs on port 8000; /api calls are proxied to it.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, strictPort: true, proxy: { '/api': 'http://localhost:8000' } },
})
