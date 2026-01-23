import * as types from '@babel/types'
import { option } from '../../option'
import { baseUtils } from '../../utils'

export default function jsxText(insertOption: any)
{
  return function (path: any)
  {
    const { node } = path
    let value = node.value

    // 定义一个包含亚洲语言代码的数组
    const asianLangs = ['zh-cn', 'ja', 'ko']
    if (asianLangs.some(lang => option.originLang!.includes(lang) || option.originLang === lang))
    {
      try
      {
        value = baseUtils.unicodeToString(value)
        console.log('jsx-------', value)
      }
      catch (error)
      {
        console.log('JSX transform error:', error)
      }
    }
    if (baseUtils.hasOriginSymbols(value) && option.excludedPattern!.length > 0 && !baseUtils.checkAgainstRegexArray(value, [...option.excludedPattern!]))
    {
      // 生成翻译节点
      const expression = baseUtils.createI18nTranslator({
        insertOption,
        value,
        isExpression: true,
      })
      // 生成的翻译节点包装在  types.JSXExpressionContainer  中
      const newNode = types.jSXExpressionContainer(expression)
      // 使用  path.replaceWith  方法将原来的节点替换为新的翻译节点
      path.replaceWith(newNode)
    }
  }
}
