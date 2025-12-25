import type { ModuleFormat } from 'rollup'
import path from 'node:path'
import { epOutput, PKG_NAME } from './utils'

export const modules = ['esm', 'cjs'] as const
export type Module = (typeof modules)[number]
export interface BuildInfo {
  bundle: {
    /** e.g: `cx/es` */
    path: string
  }
  ext: 'mjs' | 'cjs' | 'js'
  format: ModuleFormat
  module: 'ESNext' | 'CommonJS'

  output: {
    /** e.g: `es` */
    name: string
    /** e.g: `dist/cx/es` */
    path: string
  }
}

export const buildConfig: Record<Module, BuildInfo> = {
  esm: {
    module: 'ESNext',
    format: 'esm',
    ext: 'mjs',
    output: {
      name: 'es',
      path: path.resolve(epOutput, 'es'),
    },
    bundle: {
      path: `${PKG_NAME}/es`,
    },
  },
  cjs: {
    module: 'CommonJS',
    format: 'cjs',
    ext: 'js',
    output: {
      name: 'lib',
      path: path.resolve(epOutput, 'lib'),
    },
    bundle: {
      path: `${PKG_NAME}/lib`,
    },
  },
}
export const buildConfigEntries = Object.entries(
  buildConfig,
) as BuildConfigEntries

export type BuildConfig = typeof buildConfig
export type BuildConfigEntries = [Module, BuildInfo][]

export const target = 'es2018'
