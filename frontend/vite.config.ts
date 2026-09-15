import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Keep this app separate from the other project that owns port 5173.
    port: 5174,
    strictPort: true,
    host: true,
  },
})
