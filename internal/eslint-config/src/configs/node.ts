import pluginNode from 'eslint-plugin-n'
import { OptionsOverrides, TypedFlatConfigItem } from '../types'

export function node(options: OptionsOverrides): TypedFlatConfigItem[]
{
  const { overrides = {} } = options

  return [
    {
      name: 'node/rules',
      plugins: {
        node: pluginNode,
      },
      // https://github.com/eslint-community/eslint-plugin-n
      rules: {
        'node/handle-callback-err': ['error', '^(err|error)$'],
        'node/no-deprecated-api': 'error',
        'node/no-exports-assign': 'error',
        'node/no-new-require': 'error',
        'node/no-path-concat': 'error',
        'node/prefer-global/buffer': ['off', 'never'],
        'node/prefer-global/process': ['off', 'never'],
        'node/process-exit-as-throw': 'error',

        ...overrides,
      },
    },
  ]
}
