import type { Linter } from 'eslint'
import type { StylisticCustomizeOptions } from '@stylistic/eslint-plugin'
import type { Options as defineCSpellOptions } from '@cspell/eslint-plugin'

export type Rules = Record<string, Linter.RuleEntry<any> | undefined>

/**
 * An updated version of ESLint's `Linter.Config`, which provides autocompletion
 * for `rules` and relaxes type limitations for `plugins` and `rules`, because
 * many plugins still lack proper type definitions.
 */
export type TypedFlatConfigItem = Omit<Linter.Config, 'plugins' | 'rules'> & {
  /**
   * An object containing a name-value mapping of plugin names to plugin objects.
   * When `files` is specified, these plugins are only available to the matching files.
   *
   * @see [Using plugins in your configuration](https://eslint.org/docs/latest/user-guide/configuring/configuration-files-new#using-plugins-in-your-configuration)
   */
  plugins?: Record<string, any>

  /**
   * An object containing the configured rules. When `files` or `ignores` are
   * specified, these rule configurations are only available to the matching files.
   */
  rules?: Rules
}

export interface OptionsCspell extends Partial<defineCSpellOptions> {

}

export interface OptionsStylistic {
  stylistic?: boolean | StylisticConfig
}

export interface StylisticConfig
  extends Pick<StylisticCustomizeOptions, 'indent' | 'quotes' | 'jsx' | 'semi' | 'experimental'> {
}

export interface OptionsOverrides {
  overrides?: TypedFlatConfigItem['rules']
}

export interface OptionsConfig {
  /**
   * Enable cspell rules.
   *
   * @default false
   */
  cspell?: boolean | OptionsCspell

  /**
   * Extend the global ignores.
   *
   * Passing an array to extends the ignores.
   *
   * @default []
   */
  ignores?: string[]

  /**
   * Options for eslint-plugin-import-lite.
   * @see https://github.com/import-js/eslint-plugin-import/tree/main/docs/rules
   * @default true
   */
  imports?: boolean | OptionsOverrides

  /**
   * Core rules. Can't be disabled.
   */
  javascript?: OptionsOverrides

  /**
   * Enable JSDoc rules
   *
   * @see https://github.com/gajus/eslint-plugin-jsdoc
   * @default true
   */
  jsdoc?: boolean | OptionsOverrides

  /**
   * Enable JSONC support.
   *
   * @see https://ota-meshi.github.io/eslint-plugin-jsonc/rules/
   * @default true
   */
  jsonc?: boolean | OptionsOverrides

  /**
   * Enable Node.js rules
   *
   * @see https://github.com/eslint-community/eslint-plugin-n
   * @default true
   */
  node?: boolean | OptionsOverrides

  /**
   * Core rules. Can't be disabled.
   */
  perfectionist?: OptionsOverrides

  /**
   * Enable react rules.
   *
   * Requires installing:
   * - `@eslint-react/eslint-plugin`
   * - `eslint-plugin-react-hooks`
   * - `eslint-plugin-react-refresh`
   *
   * @see https://www.eslint-react.xyz/docs/rules/overview
   * @default false
   */
  react?: boolean | OptionsOverrides

  /**
   * Enable regexp rules.
   *
   * @see https://ota-meshi.github.io/eslint-plugin-regexp/
   * @default true
   */
  regexp?: boolean | OptionsOverrides

  /**
   * Enable stylistic rules.
   *
   * @see https://eslint.style/
   * @default true
   */
  stylistic?: boolean | OptionsOverrides & StylisticConfig

  /**
   * Enable TypeScript support.
   *
   * Passing an object to enable TypeScript Language Server support.
   *
   * @see https://typescript-eslint.io/rules/
   * @default auto-detect based on the dependencies
   */
  typescript?: boolean | OptionsOverrides

  /**
   * Options for eslint-plugin-unicorn.
   *
   * @see https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main/docs/rules
   * @default true
   */
  unicorn?: boolean | OptionsOverrides

  /**
   * Enable Vue support.
   *
   * @default auto-detect based on the dependencies
   */
  vue?: boolean | OptionsOverrides
}
