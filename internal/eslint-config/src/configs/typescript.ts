import parserTs from '@typescript-eslint/parser'
import pluginTs from '@typescript-eslint/eslint-plugin'
import { GLOB_TS, GLOB_TSX, GLOB_VUE } from '../globs'
import { OptionsOverrides, TypedFlatConfigItem } from '../types'

export function typescript(options: OptionsOverrides): TypedFlatConfigItem[]
{
  const { overrides = {} } = options

  return [
    {
      name: 'typescript/setup',
      plugins: {
        '@typescript-eslint': pluginTs,
      },
    },
    {
      name: 'typescript/rules',
      files: [GLOB_TS, GLOB_TSX, GLOB_VUE],
      languageOptions: {
        parser: parserTs,
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          extraFileExtensions: ['.vue'],
        },
      },
      // https://typescript-eslint.io/rules/
      rules: {
        // 关闭ESLint内置TS规则
        ...pluginTs.configs['eslint-recommended'].overrides![0]!.rules,
        // 开启TS规则
        ...pluginTs.configs.strict.rules,

        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/method-signature-style': ['error', 'property'],

        ...overrides,
      },
    },
  ]
}
