import pluginPerfectionist from 'eslint-plugin-perfectionist'
import { OptionsOverrides, TypedFlatConfigItem } from '../types'

export function perfectionist(options: OptionsOverrides): TypedFlatConfigItem[]
{
  const { overrides = {} } = options

  return [
    {
      name: 'perfectionist/rules',
      plugins: {
        perfectionist: pluginPerfectionist,
      },
      // https://perfectionist.dev/rules
      rules: {
        'perfectionist/sort-exports': ['error', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-imports': ['error', {
          groups: [
            'type',
            ['builtin', 'external'],
            'internal',
            ['parent', 'sibling', 'index'],
            'side-effect',
            'vue',
            'react',
            'unknown',
          ],
          newlinesBetween: 'ignore',
          order: 'asc',
          type: 'line-length',
          customGroups: [
            {
              groupName: 'vue',
              elementNamePattern: ['/\.vue$/'],
            },
            {
              groupName: 'react',
              elementNamePattern: ['/\.jsx$/', '/\.tsx$/'],
            },
          ],
        }],
        'perfectionist/sort-named-exports': ['error', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-named-imports': ['error', { order: 'asc', type: 'natural' }],

        'perfectionist/sort-interfaces': ['error', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-intersection-types': ['error', { order: 'asc', type: 'natural' }],

        ...overrides,
      },
    },
  ]
}
