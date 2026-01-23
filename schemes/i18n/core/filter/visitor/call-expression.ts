import * as types from '@babel/types'
import { option } from '../../option'
import { ETranslateType } from '../../enums'
import { translationManager } from '../../utils/translate'

export default function callExpression()
{
  return function (path: any, state: any)
  {
    const { node } = path

    // 提取公共部分，减少重复访问 node.callee 属性
    const callee = node.callee
    // 拓展 半自动模式下的 如 a.b.c() 调用
    if (callee.name === option.translateKey || (callee.property && callee.property.name === option.translateKey)) translateSetLang(node, state.file.opts.filenameRelative)
  }
}

/**
 * 处理翻译并设置语言对象属性
 * @param node - 调用表达式节点
 * @return
 */
function translateSetLang(node: types.CallExpression, filePath: string)
{
  // 获取调用表达式的参数
  const arg = node.arguments || []
  // 提取参数作为值
  // 检查参数是否为字符串字面量
  const code = types.isStringLiteral(arg[0]) ? arg[0].value : ''
  const label = types.isStringLiteral(arg[1]) ? arg[1].value : ''
  // 检查 ID 和值是否存在，并且第二个参数是字符串字面量
  if (code && label && types.isStringLiteral(arg[1]))
  {
    // 调用翻译工具的 setWordItem 方法设置语言对象属性
    console.log('call-expression', code, label)
    translationManager.setWordItem({ code, label, path: filePath, type: ETranslateType.Text })
  }
}
