import { $ctx } from '@milkdown/kit/utils'

export interface CustomNodeConfig {
  name?: string
}

export const defaultCustomNodeConfig: CustomNodeConfig = {
  name: 'custom',
}

export const customConfig = $ctx(
  defaultCustomNodeConfig,
  'customNodeConfigCtx',
)
