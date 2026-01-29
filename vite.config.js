// vite.config.js
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
        'auth-callback': resolve(__dirname, 'auth-callback.html'),
      },
    },
  },
})
