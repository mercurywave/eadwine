import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = Number(process.env.VITE_API_PORT)
const devPort = Number(process.env.VITE_DEV_PORT)

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'serve' && (!Number.isInteger(apiPort) || apiPort <= 0 || !Number.isInteger(devPort) || devPort <= 0)) {
    throw new Error('Start the client with the root development scripts so its dynamic ports are configured.')
  }

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: devPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
