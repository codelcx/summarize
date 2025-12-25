import pluginImports from 'eslint-plugin-import'
import { OptionsOverrides, TypedFlatConfigItem } from '../types'

export function imports(options: OptionsOverrides): TypedFlatConfigItem[]
{
  const { overrides = {} } = options

  return [
    {
      name: 'imports/rules',
      plugins: {
        import: pluginImports,
      },
      // https://github.com/import-js/eslint-plugin-import/tree/main/docs/rules
      rules: {
        // 标记仅类型导入
        'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
        // 禁止重复性导出
        'import/export': 'error',
        // 导出语句必须在最后
        'import/exports-last': 'off',
        // 导入语句必须在顶层
        'import/first': 'error',
        // 强制最后一个顶层导入后留一行/多行空行
        'import/newline-after-import': 'error',
        // 警告使用弃用语法
        'import/no-deprecated': 'warn',
        // 禁止导入相同模块多次
        'import/no-duplicates': 'error',
        // 禁止使用可变导出（var、let）
        'import/no-mutable-exports': 'error',
        // 禁止将默认导出作为本地命名导出使用
        'import/no-named-default': 'error',
        // 导入排序
        'import/order': 'off',

        ...overrides,
      },
    },
  ]
}
