import { GLOB_EXCLUDE } from '../globs'
import { OptionsConfig, TypedFlatConfigItem } from '../types'

export function ignores(options: OptionsConfig['ignores']): TypedFlatConfigItem[]
{
  return [
    {
      name: 'ignores',
      ignores: [...GLOB_EXCLUDE, ...options || []],
    },
  ]
}
