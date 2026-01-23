import { cloneDeep } from './utils/base'
import { OriginLangKeyEnum } from './enums'
import { BaseExtendsType } from './extends'

const EXCLUDED_CALL = ['console.info', 'console.warn', 'console.error', 'console.log', 'require', '_createCommentVNode']

export interface I18NConfig {
  /** 是否在构建结束之后将最新的翻译重新打包到主包中，默认不打包 */
  buildToDist?: boolean
  /** 通用翻译key，默认使用namespace，如果commonTranslateKey不为空，则使用commonTranslateKey */
  commonTranslateKey?: string
  /** 实验性属性，表示是否进行深层扫描字符串，默认为 false */
  deepScan?: boolean
  /** 打包后生成文件的主文件名称，默认是 'index' */
  distKey?: string
  /** 打包后生成文件的位置，例如 './dist/assets' */
  distPath?: string
  /** 是否启用插件，默认启用 */
  enabled?: boolean | (() => boolean)
  /** 标记不翻译调用函数列表，避免某些调用被错误翻译 */
  excludedCall?: string[]
  /** 排查不需要翻译的目录下的文件路径（黑名单）, 默认不处理node_modules */
  excludedPath?: string[]
  /** 标记不用翻译的字符串模式数组，默认是匹配文件扩展名 */
  excludedPattern?: RegExp[]
  /** 配置文件生成位置，默认为 './lang' */
  globalPath?: string
  /** 指定需要翻译文件的目录路径正则（白名单） */
  includePath?: RegExp[]
  /** 自定义文件拓展名数组 */
  insertFileExtensions?: string[]
  /** 语言key，用于请求谷歌api和生成配置文件下对应语言的内容文件 */
  langKey?: string[]
  /** 命名空间，防止全局命名冲突,，默认lang */
  namespace?: string
  /** 来源语言，默认是中文 */
  originLang?: OriginLangKeyEnum | string
  /** 是否重写配置文件，默认为true */
  rewriteConfig?: boolean
  /** 翻译目标语言列表，默认包含英文 */
  targetLangList?: string[]
  /**
   * 自定义拓展类，插件默认翻译函数挂载在window上，如果希望自定义翻译函数挂载在其他对象上，可以使用该属性
   * 注意：需要继承BaseExtends类，并且实现handleInitFile和handleCodeCall和handleCodeString方法
   */
  translateExtends?: BaseExtendsType | null
  /** 翻译调用函数，默认为 $t */
  translateKey?: string
  /** 翻译器，决定自动翻译使用的api与调用方式，默认使用 Google 翻译器并使用7890(clash)端口代理 */
  translator?: any
  /** 是否去重 */
  unique?: boolean
}
/**
 * 默认插件配置选项
 */
const defaultConfig: I18NConfig = {
  enabled: true,
  translateKey: '$t',
  excludedCall: [] as string[],
  excludedPattern: [/\.\w+$/],
  excludedPath: ['node_modules'] as string[],
  includePath: [/src\//, /src\\/],
  globalPath: './lang',
  distPath: '',
  distKey: 'index',
  originLang: OriginLangKeyEnum.ZH as OriginLangKeyEnum | string,
  targetLangList: ['en'],
  langKey: [] as string[],
  namespace: 'lang',
  buildToDist: false,
  translator: undefined,
  rewriteConfig: true,
  commonTranslateKey: '',
  deepScan: false,
  insertFileExtensions: [] as string[],
  translateExtends: null as BaseExtendsType | null,
  unique: false,
}

/**
 * 全局插件配置实例，复制自默认配置
 */
export const option: I18NConfig = { ...defaultConfig }

/**
 * 通过深度克隆提供的选项信息生成一个用户选项对象，
 * 确保原始配置不被修改。它还根据用户的配置初始化翻译器。
 * @param optionInfo - 包含用户选项和翻译器细节的选项信息。
 * @returns 一个新的、可能已初始化翻译器的用户选项对象。
 */
function generateUserOption(optionInfo: I18NConfig)
{
  // 深拷贝用户传入的配置，防止修改原配置对象
  const userOption = cloneDeep(optionInfo)
  userOption.translator = optionInfo?.translator
  if (!userOption.translator) delete userOption.translator
  return userOption
}

/**
 * 初始化插件配置选项
 * @param optionInfo 用户提供的配置选项
 */
export function initOption(optionInfo: I18NConfig = {})
{
  // 合并默认配置和用户配置
  const option = { ...defaultConfig, ...generateUserOption(optionInfo) }

  // 初始化语言key数组，包含来源语言和目标语言
  option.langKey = [option.originLang!, ...option.targetLangList!]
  // 初始化排除调用函数列表，如果用户已传入则覆盖默认
  const _excludedCall = Array.isArray(option.excludedCall) && option.excludedCall.length > 0 ? option.excludedCall : EXCLUDED_CALL

  // TODO: 如果不加上 '$t'，词语会无限循环命中 StringLiteral ？？最终导致内存溢出奔溃
  option.excludedCall = [..._excludedCall!, defaultConfig.translateKey!]
  return option
}

/**
 * 校验插件配置选项是否完整有效
 * @returns {boolean} 校验结果，完整返回 true，否则返回 false
 */
export function checkOption()
{
  // 校验翻译调用函数是否配置
  if (!option.translateKey)
  {
    console.error('❌请配置翻译调用函数')
    return false
  }

  // 校验命名空间是否配置
  if (!option.namespace)
  {
    console.error('❌请配置命名空间')
    return false
  }

  // 校验是否配置了打包后生成文件的主文件名称（如果需要打包到主包中）
  if (option.buildToDist && !option.distKey)
  {
    console.log('❌请配置打包后生成文件的主文件名称')
    return false
  }

  // 校验是否配置了打包后生成文件的位置（如果需要打包到主包中）
  if (option.buildToDist && !option.distPath)
  {
    console.log('❌请配置打包后生成文件的位置')
    return false
  }

  // 校验来源语言是否配置
  if (!option.originLang)
  {
    console.error('❌请配置来源语言')
    return false
  }

  // 校验目标翻译语言数组是否配置
  if (!option.targetLangList || option.targetLangList.length === 0)
  {
    console.error('❌请配置目标翻译语言数组')
    return false
  }

  // 如果所有校验通过，返回 true
  return true
}
