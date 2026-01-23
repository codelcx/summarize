import { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default function createPlugins(viteEnv: any, isBuild = false): Plugin[]
{
  const plugins: Plugin[] = [
    vue(),
    vueJsx(),
  ]

  if (isBuild)
  {
    // TODO: build plugin
  }

  return plugins
}
