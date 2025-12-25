import path from 'node:path'
// CSS压缩
import cssnano from 'cssnano'
// Vue插件
import vue from '@vitejs/plugin-vue'
import { Plugin, rollup } from 'rollup'
// 解析样式
import postcss from 'rollup-plugin-postcss'
// 替换字符串内容
import replace from '@rollup/plugin-replace'
import { parallel, TaskFunction } from 'gulp'
// 转为ES6模块
import commonjs from '@rollup/plugin-commonjs'
// 解析第三方模块，默认只支持相对路径以及绝对路径
import { nodeResolve } from '@rollup/plugin-node-resolve'
// 快速TS/JS转译
import esbuild, { minify as minifyPlugin } from 'rollup-plugin-esbuild'

import { target } from '../build-info'
import {
  epOutput,
  epRoot,
  formatBundleFilename,
  generateExternal,
  PKG_BRAND_NAME,
  PKG_CAMELCASE_NAME,
  version,
  withTaskName,
  writeBundles,
} from '../utils'

const banner = `/*! ${PKG_BRAND_NAME} v${version} */\n`

async function buildFullEntry(minify: boolean)
{
  const plugins: Plugin[] = [
    vue({
      isProduction: true,
      template: {
        compilerOptions: {
          hoistStatic: false,
          cacheHandlers: false,
        },
      },
    }) as any,
    postcss({
      extensions: ['.css', '.scss'],
      plugins: minify ? [cssnano()] : [],
    }),
    nodeResolve({
      // 指定解析的文件扩展名优先级
      extensions: ['.mjs', '.js', '.json', '.ts'],
    }),
    commonjs(),
    esbuild({
      // 需要排除的文件
      exclude: [],
      // 是否生成sourceMap，取决于是否开启压缩
      sourceMap: minify,
      // 目标版本
      target,
      // 需要转译的文件类型
      loaders: {
        '.vue': 'ts',
      },
      // 定义环境变量
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      // 是否开启摇树
      treeShaking: true,
    }),
    replace({
      // 将环境变量替换为硬编码的值
      'process.env.NODE_ENV': '"production"',
      'preventAssignment': true,
    }),
  ]

  if (minify)
  {
    plugins.push(
      minifyPlugin({
        target,
        sourceMap: true,
      }),
    )
  }

  const bundle = await rollup({
    input: path.resolve(epRoot, 'index.ts'),
    plugins,
    external: await generateExternal({ full: true }),
    treeshake: true,
  })

  await writeBundles(bundle, [
    {
      format: 'umd',
      file: path.resolve(
        epOutput,
        'dist',
        formatBundleFilename('index.full', minify, 'js'),
      ),
      exports: 'named',
      name: PKG_CAMELCASE_NAME,
      globals: {
        vue: 'Vue',
      },
      sourcemap: minify,
      banner,
    },
    {
      format: 'esm',
      file: path.resolve(
        epOutput,
        'dist',
        formatBundleFilename('index.full', minify, 'mjs'),
      ),
      sourcemap: minify,
      banner,
    },
  ])
}

export const buildFull = (minify: boolean) => async () => buildFullEntry(minify)

export const buildFullBundle: TaskFunction = parallel(
  withTaskName('buildFullMinified', buildFull(true)),
  withTaskName('buildFull', buildFull(false)),
)
