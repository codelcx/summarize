import types from '@babel/types'
import { option } from '../../option'
import { baseUtils } from '../../utils'
import { ETranslateType } from '../../enums'
import { translationManager } from '../../utils/translate'

// 定义一个包含亚洲语言代码的数组
const asianLangs = ['zh-cn', 'ja', 'ko']

export default function templateLiteral()
{
  return function (path: any, state: any)
  {
    // 或者通过节点位置信息从 state.file.code 中获取
    const { start, end } = path.node
    // 需要去除 前后的``
    let fullTemplate = state.file.code.slice(start + 1, end - 1)

    if (asianLangs.some(lang => option.originLang!.includes(lang) || option.originLang === lang))
    {
      try
      {
        fullTemplate = baseUtils.unicodeToString(fullTemplate || '')
        console.log('template-------', fullTemplate)
        // 去除 $ 符号
        fullTemplate = fullTemplate.replaceAll('$', '')
      }
      catch (error)
      {
        console.log('template translate error:', error)
      }
    }

    // 获取真实调用函数
    const extractFnName = baseUtils.extractFunctionName(path.parent)

    // 检查是否是排除的函数调用
    if (types.isCallExpression(path.parent) && extractFnName)
    {
      const excludeList = option.excludedCall!
      const methodName = extractFnName?.split('.')?.pop() || ''
      const isExclude = excludeList.includes(extractFnName) || excludeList.includes(methodName)
      if (isExclude) return
    }

    // 是否符合要扫描的语言
    const isScannerLang = baseUtils.hasOriginSymbols(fullTemplate)
    // 是否符合排除规则
    const isExclude = option.excludedPattern && baseUtils.checkAgainstRegexArray(fullTemplate, [...option.excludedPattern!])
    if (fullTemplate && isScannerLang && !isExclude)
    {
      const code = baseUtils.generateId(fullTemplate)
      if (code)
      {
        translationManager.setWordItem({
          code,
          label: fullTemplate,
          path: state.file.opts.filenameRelative,
          type: ETranslateType.ParamText,
        })
      }
    }
  }
}
