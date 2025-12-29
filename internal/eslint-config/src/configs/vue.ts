import pluginVue from 'eslint-plugin-vue'
import parserVue from 'vue-eslint-parser'
import parserTs from '@typescript-eslint/parser'
import { GLOB_VUE } from '../globs'
import { OptionsOverrides, OptionsStylistic, TypedFlatConfigItem } from '../types'

export function vue(options: OptionsOverrides & OptionsStylistic): TypedFlatConfigItem[]
{
  const { overrides = {}, stylistic = true } = options

  const {
    indent = 2,
  } = typeof stylistic === 'boolean' ? {} : stylistic

  return [
    {
      languageOptions: {
        globals: {
          computed: 'readonly',
          defineEmits: 'readonly',
          defineExpose: 'readonly',
          defineProps: 'readonly',
          onMounted: 'readonly',
          onUnmounted: 'readonly',
          reactive: 'readonly',
          ref: 'readonly',
          shallowReactive: 'readonly',
          shallowRef: 'readonly',
          toRef: 'readonly',
          toRefs: 'readonly',
          watch: 'readonly',
          watchEffect: 'readonly',
        },
      },
      name: 'vue/setup',
      plugins: {
        vue: pluginVue,
      },
    },
    {
      files: [GLOB_VUE],
      languageOptions: {
        parser: parserVue,
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
          parser: parserTs,
          extraFileExtensions: ['.vue'],
          sourceType: 'module',
        },
      },
      name: 'vue/rules',
      // https://eslint.vuejs.org/rules/
      rules: {
        ...pluginVue.configs.base.rules,
        ...pluginVue.configs['flat/essential'].map(c => c.rules).reduce((accumulator, c) => ({ ...accumulator, ...c }), {}),
        ...pluginVue.configs['flat/strongly-recommended'].map(c => c.rules).reduce((accumulator, c) => ({ ...accumulator, ...c }), {}),
        ...pluginVue.configs['flat/recommended'].map(c => c.rules).reduce((accumulator, c) => ({ ...accumulator, ...c }), {}),

        'vue/comment-directive': 'off',
        'unicorn/no-array-reduce': 'off',
        'vue/component-name-in-template-casing': ['error', 'PascalCase'],
        'vue/component-options-name-casing': ['error', 'PascalCase'],
        'vue/component-tags-order': 'off',
        'vue/custom-event-name-casing': ['error', 'camelCase'],
        'vue/define-macros-order': ['error', {
          order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'],
        }],
        'vue/dot-location': ['error', 'property'],
        'vue/dot-notation': ['error', { allowKeywords: true }],
        'vue/eqeqeq': ['error', 'smart'],
        'vue/html-indent': ['error', indent],
        'vue/html-quotes': ['error', 'double'],
        'vue/max-attributes-per-line': 'off',
        'vue/multi-word-component-names': 'off',
        'vue/no-dupe-keys': 'off',
        'vue/no-empty-pattern': 'error',
        'vue/no-irregular-whitespace': 'error',
        'vue/no-loss-of-precision': 'error',
        'vue/no-restricted-syntax': [
          'error',
          'DebuggerStatement',
          'LabeledStatement',
          'WithStatement',
        ],
        'vue/no-restricted-v-bind': ['error', '/^v-/'],
        'vue/no-setup-props-reactivity-loss': 'off',
        'vue/no-sparse-arrays': 'error',
        'vue/no-unused-refs': 'error',
        'vue/no-useless-v-bind': 'error',
        'vue/no-v-html': 'off',
        'vue/object-shorthand': [
          'error',
          'always',
          {
            avoidQuotes: true,
            ignoreConstructors: false,
          },
        ],
        'vue/prefer-separate-static-class': 'error',
        'vue/prefer-template': 'error',
        'vue/prop-name-casing': ['error', 'camelCase'],
        'vue/require-default-prop': 'off',
        'vue/require-prop-types': 'off',
        'vue/space-infix-ops': 'error',
        'vue/space-unary-ops': ['error', { nonwords: false, words: true }],

        ...overrides,
      },
    },
  ]
}
