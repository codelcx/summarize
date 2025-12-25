import propertyGroup from 'stylelint-config-recess-order/groups'

/** @type {import('stylelint').Config} */
export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-scss',
    'stylelint-config-standard-vue/scss',
    'stylelint-config-recess-order',
    '@stylistic/stylelint-config',
  ],
  plugins: [
    'stylelint-scss',
    'stylelint-order',
    '@stylistic/stylelint-plugin',
  ],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],
  rules: {
    'order/properties-order': propertyGroup,
    '@stylistic/block-opening-brace-newline-after': 'always',
    '@stylistic/block-closing-brace-newline-before': 'always',
  },
  overrides: [
    {
      files: ['**/*.vue', '**/*.scss', '**/*.sass'],
      rules: {
        'selector-nested-pattern': null,
      },
    },
  ],
}
