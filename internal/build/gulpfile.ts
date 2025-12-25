import path from 'node:path'
import { copyFile, mkdir } from 'node:fs/promises'
import { parallel, series, TaskFunction } from 'gulp'
import { epOutput, epPackage, projRoot, run, runTask, withTaskName } from './src'

/**
 * 满足以下条件将会在执行时注册任务（命令）
 * 1、从本文件中导出
 * 2、任务函数必须是异步的 @type{TaskFunction}
 */

export const copyFiles = async () =>
  Promise.all([
    copyFile(epPackage, path.join(epOutput, 'package.json')),
    copyFile(
      path.resolve(projRoot, 'README.md'),
      path.resolve(epOutput, 'README.md'),
    ),
    copyFile(
      path.resolve(projRoot, 'typings', 'global.d.ts'),
      path.resolve(epOutput, 'global.d.ts'),
    ),
  ])

const build: TaskFunction = series(
  withTaskName('clean', () => run('pnpm run clean')),
  withTaskName('createOutput', () => mkdir(epOutput, { recursive: true })),

  runTask('cleanTypeBuildInfo'),

  parallel(
    runTask('buildModules'),
    runTask('buildFullBundle'),
    runTask('generateTypesDefinitions'),
  ),

  runTask('copyTypesDefinitions'),
  runTask('cleanTypesDefinitions'),
  runTask('copyFiles'),

  runTask('cleanTypeBuildInfo'),
)

export default build
export * from './src'
