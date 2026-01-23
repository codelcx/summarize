import types, { Node } from '@babel/types'
import { option } from '../option'
import { REGEX_MAP } from '../constants'
import { OriginLangKeyEnum } from '../enums'

export function getOriginRegex()
{
  const originLang = option.originLang as OriginLangKeyEnum
  return REGEX_MAP[originLang]
}

/**
 * 是否包含来源语言字符
 * @param {string} code
 * @return {*}
 */
export function hasOriginSymbols(code: string)
{
  return getOriginRegex().test(code)
}

/**
 * 过滤注释
 * @param {string} code
 * @return {*}
 */
export const removeComments = function (code: string)
{
  // 使用正则表达式匹配并删除单行注释
  code = code.replaceAll(/\/\/.*\n/g, '')
  // 使用正则表达式匹配并删除多行注释
  code = code.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  // 使用正则表达式匹配并删除HTML注释
  code = code.replaceAll(/<!--[\s\S]*?-->/g, '')
  return code
}

/**
 * 用于判断提供的值是否符合正则表达式数组中的任一规则，符合则跳过
 * @param {*} value
 * @param {*} regexArray
 * @return {*}
 */
export function checkAgainstRegexArray(value: string, regexArray: string[] | RegExp[])
{
  for (const element of regexArray)
  {
    const regex = typeof element === 'string' ? new RegExp(element) : element
    if ((regex as RegExp).test(value))
    {
      return true
    }
  }
  return false
}

/**
 * 用于解析抽象语法树中的调用表达式，并提取出调用的名称，如a.b.c() 取 c。
 * @param {any} node
 * @return {*}
 */
export function extractFunctionName(node: Node): string
{
  let callName = ''
  function callObjName(callObj: any, name: string): string
  {
    name += `.${(callObj.property as any).name}`
    if (types.isMemberExpression(callObj.object))
    {
      // isMemberExpression： 是否是成员表达式
      return callObjName(callObj.object, name)
    }
    name = (callObj.object as any).name + name
    return name
  }
  if (types.isCallExpression(node))
  {
    // isCallExpression： 是否是调用表达式
    callName = types.isMemberExpression((node as any).callee) ? callObjName((node as any).callee, '') : ((node as any).callee as any).name || ''
  }
  return callName
}

// /**
//  * 提取文件的中文部分
//  * @param {string} fileContent
//  * @return {*}
//  */
// export const extractCnStrings = (fileContent: string) =>
// {
//   const regex = /[^\u0000-\u00FF]+/g
//   return extractStrings(fileContent, regex)
// }

// /**
//  * 提取文件指定部分内容
//  * @param {string} fileContent
//  * @param {any} regex
//  * @return {*}
//  */
// export function extractStrings(fileContent: string, regex: any)
// {
//   const matches = fileContent.match(regex)
//   return matches ? matches.filter((item, index) => matches.indexOf(item) === index) : []
// }

/**
 * 生成i8n翻译函数
 */
export function createI18nTranslator(createOption: { value: string, isExpression?: boolean, key?: string, insertOption?: any }): any
{
  const { value, isExpression = false, key, insertOption } = createOption

  // 从全局配置对象 option 中获取命名空间
  const nameSpace = option.namespace!
  // 去除 value 字符串首尾的空白字符
  const trimmedValue = value.trim()
  // 将去除空白后的字符串中的单引号替换为双引号，并将换行符替换为转义字符 \n
  const valStr = trimmedValue.replaceAll('\'', '"').replaceAll(/(\n)/g, String.raw`\n`)
  // 若 key 存在则使用 key，否则调用 generateId 函数根据 valStr 生成唯一的键
  const generatedKey = key || generateId(valStr)
  // 提取公共配置对象，避免重复代码
  const config = {
    option,
    hash: generatedKey,
    value: trimmedValue,
    uncodeValue: valStr,
    namespace: nameSpace,
  }

  if (option.translateExtends)
  {
    const { handleCodeCall, handleCodeString } = option.translateExtends
    return isExpression ? handleCodeCall(config, insertOption) : handleCodeString(config, insertOption)
  }

  if (isExpression)
  {
    const valueExp = types.stringLiteral(trimmedValue)
    valueExp.extra = {
      raw: `'${valStr}'`, // 防止转码为unicode
      rawValue: trimmedValue,
    }
    return types.callExpression(types.identifier(option.translateKey!), [types.stringLiteral(generatedKey), valueExp, types.stringLiteral(nameSpace)])
  }

  return `${option.translateKey}('${generatedKey}','${valStr}','${nameSpace}')`
}

/**
 * 生成唯一ID
 */
export function generateId(key: string)
{
  let hash = 0
  for (let i = 0; i < key.length; i++)
  {
    const charCode = key.codePointAt(i) ?? 0
    hash = (hash << 5) - hash + charCode
    hash = hash & hash
  }
  const id = Math.abs(hash).toString(36) + key.length.toString(36)
  return id
}

/**
 * unicode转普通字符串
 * @param {string} str
 * @return {*}
 */
export const unicodeToString = (str: string) =>
{
  return str.replaceAll(/\\u[\dA-Fa-f]{4}/g, (match: any) =>
  {
    return String.fromCodePoint(Number.parseInt(match.replaceAll(String.raw`\u`, ''), 16))
  })
}

/**
 * 有道翻译 标识截取
 * @param {string} q
 * @return {*}
 */
export function truncate(q: string)
{
  // 检查输入字符串的长度
  if (q.length <= 20)
  {
    // 如果长度小于等于20，直接返回原字符串
    return q
  }
  else
  {
    // 如果长度大于20，截取前10个字符和后10个字符，并在中间插入长度信息
    const len = q.length
    return q.slice(0, 10) + len + q.slice(Math.max(0, len - 10))
  }
}

// 导出一个深拷贝函数，用于克隆对象
export function cloneDeep<T>(value: T, cache: WeakMap<object, any> = new WeakMap()): T
{
  // 处理基本类型和 null
  if (typeof value !== 'object' || value === null)
  {
    return value
  }

  // 处理循环引用
  if (cache.has(value))
  {
    return cache.get(value)
  }

  // 处理特殊对象类型
  if (value instanceof Date)
  {
    return new Date(value) as T
  }

  if (value instanceof RegExp)
  {
    return new RegExp(value.source, value.flags) as T
  }

  // 初始化克隆容器
  const clone: any = Array.isArray(value) ? [] : {}

  // 缓存对象防止循环引用
  cache.set(value, clone)

  // 处理 Symbol 和普通键的枚举
  const keys = [
    ...Object.keys(value),
    ...Object.getOwnPropertySymbols(value).filter(sym => Object.prototype.propertyIsEnumerable.call(value, sym)),
  ]

  // 递归克隆属性
  for (const key of keys)
  {
    clone[key] = cloneDeep((value as any)[key], cache)
  }

  return clone as T
}
