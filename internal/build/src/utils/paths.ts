import { resolve } from 'node:path'

export const projRoot = resolve(import.meta.dirname, '..', '..', '..', '..')
export const pkgRoot = resolve(projRoot, 'packages')
export const buildRoot = resolve(projRoot, 'internal', 'build')
export const epRoot = resolve(pkgRoot, 'cx')
export const epPackage = resolve(epRoot, 'package.json')

/** `/dist` */
export const buildOutput = resolve(projRoot, 'dist')
/** `/dist/cx` */
export const epOutput = resolve(buildOutput, 'cx')

const windowsSlashRE = /\\/g
/**
 * 路径规范化函数，主要解决 Windows 系统上的路径分隔符问题
 * Normalize a path to use forward slashes.
 * This is useful for ensuring consistent path formatting across different platforms.
 */
export function normalizePath(p: string): string
{
  if (typeof process !== 'undefined' && process.platform === 'win32')
  {
    return p.replaceAll(windowsSlashRE, '/')
  }
  return p
}
