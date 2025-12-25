import pluginStylistic from '@stylistic/eslint-plugin'
import { OptionsOverrides, StylisticConfig, TypedFlatConfigItem } from '../types'

export const StylisticConfigDefaults: StylisticConfig = {
  experimental: false,
  indent: 2,
  jsx: true,
  quotes: 'single',
  semi: false,
}

export function stylistic(options: OptionsOverrides & StylisticConfig): TypedFlatConfigItem[]
{
  const {
    experimental,
    indent,
    jsx,
    overrides = {},
    quotes,
    semi,
  } = {
    ...StylisticConfigDefaults,
    ...options,
  }

  const config = pluginStylistic.configs.customize({
    experimental,
    indent,
    jsx,
    pluginName: '@stylistic',
    quotes,
    semi,
  })

  return [
    {
      name: 'stylistic/rules',
      plugins: {
        '@stylistic': pluginStylistic,
      },
      // https://eslint.style/rules
      rules: {
        ...config.rules,
        '@stylistic/function-call-spacing': ['error', 'never'],
        '@stylistic/brace-style': ['error', 'allman'],
        '@stylistic/object-curly-newline': ['error',
          {
            ObjectExpression: { consistent: true },
            ObjectPattern: { consistent: true },
            ImportDeclaration: { consistent: true },
            ExportDeclaration: { consistent: true },
            TSTypeLiteral: { consistent: true },
            TSInterfaceBody: { consistent: true },
            TSEnumBody: { consistent: true },
          },
        ],

        ...overrides,
      },
    },
  ]
}
