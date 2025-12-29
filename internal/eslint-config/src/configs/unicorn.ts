import pluginUnicorn from 'eslint-plugin-unicorn'
import { OptionsOverrides, TypedFlatConfigItem } from '../types'

export function unicorn(options: OptionsOverrides): TypedFlatConfigItem[]
{
  const { overrides = {} } = options

  return [
    {
      name: 'unicorn/rules',
      plugins: {
        unicorn: pluginUnicorn,
      },
      // https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main/docs/rules
      rules: {
        ...pluginUnicorn.configs.recommended.rules,

        'unicorn/no-array-reduce': 'off',
        'unicorn/consistent-empty-array-spread': 'error',
        'unicorn/error-message': 'error',
        'unicorn/escape-case': 'error',
        'unicorn/new-for-builtins': 'error',
        'unicorn/no-instanceof-builtins': 'error',
        'unicorn/no-new-array': 'error',
        'unicorn/no-new-buffer': 'error',
        'unicorn/number-literal-case': 'error',
        'unicorn/prefer-dom-node-text-content': 'error',
        'unicorn/prefer-includes': 'error',
        'unicorn/prefer-node-protocol': 'error',
        'unicorn/prefer-number-properties': 'error',
        'unicorn/prefer-string-starts-ends-with': 'error',
        'unicorn/prefer-type-error': 'error',
        'unicorn/throw-new-error': 'error',
        'unicorn/prevent-abbreviations': 'off',
        'unicorn/import-style': 'off',
        'unicorn/prefer-module': 'off',
        'unicorn/no-empty-file': 'off',
        'unicorn/no-null': 'off',
        'unicorn/filename-case': [
          'error',
          {
            cases: {
              kebabCase: true, // 小写
              camelCase: true, // 驼峰
              pascalCase: true, // 大写
              snakeCase: false, // 下划线
            },
          },
        ],
        'unicorn/consistent-function-scoping': 'off',
        'unicorn/prefer-global-this': 'off',
        'unicorn/require-module-specifiers': 'off',
        'unicorn/no-array-for-each': 'off',

        ...overrides,
      },
    },
  ]
}
