import { MilkdownPlugin } from '@milkdown/kit/ctx'
import { customView } from './view'
import { customSchema } from './schema'
import { customConfig } from './config'

export const customComponent: MilkdownPlugin[] = [
  customSchema,
  customView,
  customConfig,
].flat()
