import { TaskFunction } from 'gulp'
import { run } from './process'
import { buildRoot } from './paths'

/**
 * 执行自定义命令
 * @param name 任务名称
 * @param fn 任务函数
 * @returns 任务函数
 */
export const withTaskName = <T extends TaskFunction>(name: string, fn: T) =>
  Object.assign(fn, { displayName: name })

/**
 * 执行指定命令
 * @param name 需要执行的任务名
 * @returns 任务函数
 */
export const runTask = (name: string) =>
  withTaskName(`shellTask:${name}`, () =>
    run(`pnpm run start ${name}`, buildRoot),
  )
