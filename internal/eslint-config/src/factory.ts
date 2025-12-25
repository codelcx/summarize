import { Linter } from 'eslint'
import { isPackageExists } from 'local-pkg'
import { OptionsConfig, TypedFlatConfigItem } from './types'
import {
  cspell,
  ignores,
  imports,
  javascript,
  jsdoc,
  jsonc,
  node,
  perfectionist,
  react,
  regexp,
  stylistic,
  typescript,
  unicorn,
  vue,
} from './configs'

const VuePackages = [
  'vue',
  'nuxt',
  'vitepress',
]

export function cx(options: OptionsConfig = {}): Linter.Config[]
{
  const {
    imports: enableImports = true,
    jsdoc: enableJsdoc = true,
    jsonc: enableJsonc = true,
    node: enableNode = true,
    regexp: enableRegexp = true,
    cspell: enableCspell = false,
    stylistic: enableStylistic = true,
    typescript: enableTypeScript = isPackageExists('typescript'),
    unicorn: enableUnicorn = true,
    react: enableReact = false,
    vue: enableVue = VuePackages.some(index => isPackageExists(index)),
  } = options

  const configs: TypedFlatConfigItem[] = []

  const stylisticOptions = options.stylistic === false
    ? false
    : (typeof options.stylistic === 'object'
        ? options.stylistic
        : {})

  configs.push(
    ...ignores(options.ignores),
    ...javascript({
      overrides: getOverrides(options, 'javascript'),
    }),
    ...perfectionist({
      overrides: getOverrides(options, 'perfectionist'),
    }),
  )

  if (enableCspell)
  {
    const cspellOptions = typeof options.cspell === 'boolean' ? {} : options.cspell || {}
    configs.push(...cspell(cspellOptions))
  }

  if (enableImports)
  {
    configs.push(...imports({
      overrides: getOverrides(options, 'imports'),
    }))
  }

  if (enableStylistic)
  {
    configs.push(...stylistic({
      ...stylisticOptions,
      overrides: getOverrides(options, 'stylistic'),
    }))
  }

  if (enableRegexp)
  {
    configs.push(...regexp({
      overrides: getOverrides(options, 'regexp'),
    }))
  }

  if (enableJsdoc)
  {
    configs.push(...jsdoc({
      overrides: getOverrides(options, 'jsdoc'),
    }))
  }

  if (enableJsonc)
  {
    configs.push(...jsonc({
      overrides: getOverrides(options, 'jsonc'),
    }))
  }

  if (enableUnicorn)
  {
    configs.push(...unicorn({
      overrides: getOverrides(options, 'unicorn'),
    }))
  }

  if (enableNode)
  {
    configs.push(...node({
      overrides: getOverrides(options, 'node'),
    }))
  }

  if (enableTypeScript)
  {
    configs.push(...typescript({
      overrides: getOverrides(options, 'typescript'),
    }))
  }

  if (enableVue)
  {
    configs.push(...vue({
      ...stylisticOptions,
      overrides: getOverrides(options, 'vue'),
    }))
  }

  if (enableReact)
  {
    configs.push(...react({
      overrides: getOverrides(options, 'react'),
    }))
  }

  return configs
}

export function getOverrides<K extends keyof OptionsConfig>(
  options: OptionsConfig,
  key: K,
): Partial<Linter.RulesRecord>
{
  return typeof options[key] === 'boolean'
    ? {} as any
    : options[key] || {} as any
}
