import types from '@babel/types'
import { option } from '../../option'
import { ETranslateType } from '../../enums'
import { baseUtils, splitUtils } from '../../utils'
import { translationManager } from '../../utils/translate'

export default function stringLiteral(insertOption: any)
{
  return function (path: any, state: any)
  {
    const { node, parent } = path
    let value = node.value

    // 定义一个包含亚洲语言代码的数组
    const asianLangs = ['zh-cn', 'ja', 'ko']
    if (asianLangs.some(lang => option.originLang!.includes(lang) || option.originLang === lang))
    {
      try
      {
        value = baseUtils.unicodeToString(value)
        console.log('string-------', value)
      }
      catch (error)
      {
        console.log('string transform error:', error)
      }
    }

    if (
      baseUtils.hasOriginSymbols(value) && option.excludedPattern!.length > 0
      && !baseUtils.checkAgainstRegexArray(value, [...option.excludedPattern!]))
    {
      // 获取真实调用函数
      const extractFnName = baseUtils.extractFunctionName(parent)

      // 检查是否是翻译函数调用（如$t)
      const isTranslateCall = parent?.callee?.property?.name === option.translateKey
      // 检查是否是导入语句
      const isImportDeclaration = types.isImportDeclaration(parent)
      // 检查是否是键值对的键
      const isKey = parent.key === node

      if (isTranslateCall || isImportDeclaration || isKey) return

      // 检查是否是排除的函数调用
      if (types.isCallExpression(path.parent) && extractFnName)
      {
        const excludeList = option.excludedCall!
        const methodName = extractFnName?.split('.')?.pop() || ''
        const isExclude = excludeList.includes(extractFnName) || excludeList.includes(methodName)
        if (isExclude) return
      }

      // let replaceNode
      // if (option.deepScan && splitUtils.checkNeedSplit(value))
      // {
      //   replaceNode = splitUtils.convertToTemplateLiteral(splitUtils.splitByRegex(value, baseUtils.getOriginRegex()), insertOption)
      // }
      // else if (types.isJSXAttribute(parent))
      // {
      //   const expression = baseUtils.createI18nTranslator({
      //     insertOption,
      //     value,
      //     isExpression: true,
      //   })
      //   replaceNode = types.jSXExpressionContainer(expression)
      // }
      // else
      // {
      //   replaceNode = baseUtils.createI18nTranslator({
      //     insertOption,
      //     value,
      //     isExpression: true,
      //   })
      // }

      // path.replaceWith(replaceNode)

      // 是否符合要扫描的语言
      const isScannerLang = baseUtils.hasOriginSymbols(value)
      // 是否符合排除规则
      const isExclude = option.excludedPattern && baseUtils.checkAgainstRegexArray(value, [...option.excludedPattern!])
      if (value && isScannerLang && !isExclude)
      {
        const code = baseUtils.generateId(value)
        if (code)
        {
          translationManager.setWordItem({
            code,
            label: value,
            path: state.file.opts.filenameRelative,
            type: ETranslateType.Text,
          })
        }
      }
    }
  }
}
