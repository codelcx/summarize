import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import createPlugins from './vite/plugins'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) =>
{
  const env = loadEnv(mode, process.cwd())
  return {
    server: {
      host: '0.0.0.0',
      open: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: createPlugins(env, command === 'build'),
  }
})
