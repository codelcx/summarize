import JSXTextFn from './visitor/jsx-ext'
import StringLiteralFn from './visitor/string-literal'
import TemplateLiteral from './visitor/template-literal'
import CallExpressionFn from './visitor/call-expression'

export default function filter(insertOption?: any)
{
  // 分别调用各个访问器函数并传入插入选项
  const stringLiteralVisitor = StringLiteralFn(insertOption)
  const jsxTextVisitor = JSXTextFn(insertOption)
  const templateLiteralVisitor = TemplateLiteral()
  const callExpressionVisitor = CallExpressionFn()

  // 返回一个函数，该函数返回包含访问器的对象
  return function ()
  {
    return {
      // 定义 Babel 访问器对象
      visitor: {
        StringLiteral: stringLiteralVisitor,
        JSXText: jsxTextVisitor,
        TemplateLiteral: templateLiteralVisitor,
        CallExpression: callExpressionVisitor,
      },
    }
  }
}
