import pluginCspell from '@cspell/eslint-plugin'
import { OptionsCspell, TypedFlatConfigItem } from '../types'

export function cspell(options: OptionsCspell): TypedFlatConfigItem[]
{
  const defaultOptions: OptionsCspell = {
    autoFix: true,
    checkComments: true,
  }

  return [
    {
      name: 'cspell/rules',
      plugins: {
        '@cspell': pluginCspell,
      },
      rules: {
        '@cspell/spellchecker': ['warn', {
          ...defaultOptions,
          ...options,
        }],
      },
    },
  ]
}
