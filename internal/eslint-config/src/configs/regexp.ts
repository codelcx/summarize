import { configs } from 'eslint-plugin-regexp'
import { OptionsOverrides, TypedFlatConfigItem } from '../types'

export function regexp(options: OptionsOverrides): TypedFlatConfigItem[]
{
  const { overrides = {} } = options
  const config = configs['flat/recommended']

  return [
    {
      name: 'regexp/rules',
      ...config,
      // https://ota-meshi.github.io/eslint-plugin-regexp/rules/
      rules: {
        ...config.rules,
        ...overrides,
      },
    },
  ]
}
