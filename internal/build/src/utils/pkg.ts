import type { ProjectManifest } from '@pnpm/types'
import { PKG_PREFIX } from './constants'
import { normalizePath, projRoot } from './paths'
import { buildConfig, Module } from '../build-info'

export const getPackageManifest = (pkgPath: string) =>
{
  return require(pkgPath) as ProjectManifest
}

export const getPackageDependencies = (pkgPath: string): Record<'dependencies' | 'peerDependencies', string[]> =>
{
  const manifest = getPackageManifest(pkgPath)
  const { dependencies = {}, peerDependencies = {} } = manifest

  return {
    dependencies: Object.keys(dependencies),
    peerDependencies: Object.keys(peerDependencies),
  }
}

export const excludeFiles = (files: string[]) =>
{
  const excludes = ['node_modules', 'test', 'mock', 'gulpfile', 'dist']
  const projRootPath = normalizePath(projRoot)
  return files.filter((file) =>
  {
    const position = file.startsWith(projRootPath) ? projRootPath.length : 0
    return !excludes.some(exclude => file.includes(exclude, position))
  })
}

/** used for type generator */
export const pathRewriter = (module: Module) =>
{
  const config = buildConfig[module]

  return (id: string) =>
  {
    id = id.replaceAll(`${PKG_PREFIX}/`, `${config.bundle.path}/`)
    return id
  }
}
