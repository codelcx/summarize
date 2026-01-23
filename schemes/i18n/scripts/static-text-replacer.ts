/**
 * 国际化静态文本自动替换工具
 *
 * 功能：
 * 1. 读取语言JSON文件，找出type为0的静态文本词条
 * 2. 根据path字段定位源文件，支持逗号分隔的多路径格式
 * 3. 将label_zh-cn的值替换为$t('code')格式，支持Vue模板和JS字符串
 * 4. 记录替换过程和失败日志，生成详细的统计报告
 */

import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import workerThreads from 'node:worker_threads'

/**
 * 语言词条接口定义
 */
interface ILanguageItem
{
  'category': string
  'code': string
  'label_zh-cn': string
  'path': string
  'type': number
}

/**
 * 工具配置接口
 */
interface IReplacementConfig
{
  /** 是否启用调试模式 */
  debug: boolean
  /** 是否实际执行替换（false为预览模式） */
  dryRun: boolean
  /** 语言JSON文件路径 */
  languageFilePath: string
  /** 需要替换的源代码目录 */
  sourceDirectory: string
}

/**
 * 替换结果统计
 */
interface IReplacementStats
{
  /** 成功替换的次数（单个文件的替换算一次） */
  successfulReplacements: number
  /** 处理的文件总数（考虑多路径词条） */
  totalFiles: number
  /** 处理的词条总数 */
  totalItems: number
  /** 失败的替换记录 */
  failedReplacements: Array<{
    code: string
    filePath: string
    searchText: string
    reason: string
  }>
  /** 跳过的词条（文件不存在等） */
  skippedItems: Array<{
    code: string
    filePath: string
    reason: string
  }>
}

class I18nStaticTextReplacer
{
  private config: IReplacementConfig
  private stats: IReplacementStats
  private logger: {
    info: (message: string) => void
    warn: (message: string) => void
    error: (message: string) => void
    success: (message: string) => void
  }

  constructor(config: IReplacementConfig)
  {
    this.config = config
    this.stats = {
      totalItems: 0,
      totalFiles: 0,
      successfulReplacements: 0,
      failedReplacements: [],
      skippedItems: [],
    }

    // 初始化日志记录器
    this.logger = {
      info: (msg: string) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
      warn: (msg: string) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
      success: (msg: string) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
    }
  }

  /**
   * 读取并解析语言JSON文件
   */
  private async loadLanguageFile(): Promise<ILanguageItem[]>
  {
    try
    {
      const filePath = path.resolve(this.config.languageFilePath)
      this.logger.info(`正在读取语言文件: ${filePath}`)

      const fileContent = await fs.readFile(filePath, 'utf8')
      const languageItems: ILanguageItem[] = JSON.parse(fileContent)

      this.logger.info(`成功读取语言文件，共 ${languageItems.length} 个词条`)
      return languageItems
    }
    catch (error)
    {
      this.logger.error(`读取语言文件失败: ${error}`)
      throw error
    }
  }

  /**
   * 过滤出type为0的静态文本词条，并按源代码目录过滤
   */
  private filterStaticTextItems(items: ILanguageItem[]): ILanguageItem[]
  {
    // 首先过滤出 type 为 0 的词条
    const staticItems = items.filter(item => item.type === 0)
    this.logger.info(`找到 ${staticItems.length} 个静态文本词条（type=0）`)

    // 如果用户指定了特定的源代码目录（不是默认的 ./src），则按路径过滤
    if (this.config.sourceDirectory !== './src')
    {
      // 标准化路径格式，移除开头的 './'
      const normalizedSourceDir = this.config.sourceDirectory.replace(/^\.\//, '')

      const filteredItems = staticItems.filter((item) =>
      {
        // 检查词条路径是否在指定的源代码目录下
        // 支持两种匹配方式：
        // 1. 直接匹配：item.path 以 normalizedSourceDir 开头
        // 2. 去除 src/ 前缀后匹配：适应 src/views/... 这样的路径格式
        const itemPathWithoutSrc = item.path.replace(/^src\//, '')
        return item.path.startsWith(normalizedSourceDir) || itemPathWithoutSrc.startsWith(normalizedSourceDir)
      })

      this.logger.info(`按源代码目录过滤后，剩余 ${filteredItems.length} 个词条需要处理`)

      if (filteredItems.length === 0)
      {
        this.logger.warn(`在指定的源代码目录 "${this.config.sourceDirectory}" 中没有找到匹配的词条`)
        this.logger.info('提示：请检查源代码目录路径是否正确，或使用默认的 "./src" 目录')
        this.logger.info('注意：语言文件中的路径可能包含 "src/" 前缀，工具会自动处理这种情况')
      }

      return filteredItems
    }

    return staticItems
  }

  /**
   * 检查文件是否存在
   */
  private async checkFileExists(filePath: string): Promise<boolean>
  {
    try
    {
      await fs.access(filePath)
      return true
    }
    catch
    {
      return false
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(text: string): string
  {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  }

  /**
   * 在文件中查找并替换文本
   */
  private async replaceTextInFile(filePath: string, searchText: string, replaceWith: string): Promise<boolean>
  {
    try
    {
      const content = await fs.readFile(filePath, 'utf8')

      // 创建多种匹配模式的正则表达式
      const escapedText = this.escapeRegExp(searchText)
      const patterns = [
        // 1. 匹配双引号中的文本
        {
          pattern: new RegExp(`"${escapedText}"`, 'g'),
          replacement: `$t('${replaceWith}')`,
        },
        // 2. 匹配单引号中的文本
        {
          pattern: new RegExp(`'${escapedText}'`, 'g'),
          replacement: `$t('${replaceWith}')`,
        },
        // 3. 匹配模板字符串中的文本
        {
          pattern: new RegExp(`\`${escapedText}\``, 'g'),
          replacement: `$t('${replaceWith}')`,
        },
        // 4. 匹配Vue模板中的纯文本（在标签内容中）
        {
          pattern: new RegExp(`(>[^<]*?)${escapedText}([^<]*?<)`, 'g'),
          replacement: `$1{{ $t('${replaceWith}') }}$2`,
        },
        // 5. 匹配Vue模板表达式中的纯文本（如 "}} 文档" 这样的模式）
        {
          pattern: new RegExp(`(}}\s*)${escapedText}`, 'g'),
          replacement: `$1{{ $t('${replaceWith}') }}`,
        },
        // 6. 匹配在模板表达式前的纯文本（如 "文档 {{"）
        {
          pattern: new RegExp(`${escapedText}(\s*\{\{)`, 'g'),
          replacement: `{{ $t('${replaceWith}') }}$1`,
        },
      ]

      let replaced = false
      let newContent = content

      for (const { pattern, replacement } of patterns)
      {
        if (pattern.test(content))
        {
          newContent = newContent.replace(pattern, replacement)
          replaced = true
          break
        }
      }

      if (replaced && !this.config.dryRun)
      {
        await fs.writeFile(filePath, newContent, 'utf8')
      }

      return replaced
    }
    catch (error)
    {
      this.logger.error(`处理文件 ${filePath} 时发生错误: ${error}`)
      return false
    }
  }

  /**
   * 处理单个语言词条（支持多路径，用逗号分隔）
   */
  private async processLanguageItem(item: ILanguageItem): Promise<void>
  {
    // 检查路径是否包含多个文件（用逗号分隔）
    const filePaths = item.path.includes(',')
      ? item.path.split(',').map(p => p.trim()).filter(p => p.length > 0)
      : [item.path]

    if (filePaths.length > 1)
    {
      this.logger.info(`词条 ${item.code} 包含 ${filePaths.length} 个文件路径，将分别处理`)
    }

    // 更新文件总数统计
    this.stats.totalFiles += filePaths.length

    // 处理每个文件路径
    for (const filePath of filePaths)
    {
      await this.processSingleFilePath(item, filePath)
    }
  }

  /**
   * 处理单个文件路径的词条替换
   */
  private async processSingleFilePath(item: ILanguageItem, filePath: string): Promise<void>
  {
    // 确定目标文件路径
    let targetFilePath: string

    // 如果用户指定了特定的源代码目录（不是默认的 ./src），使用相对于项目根目录的路径
    if (this.config.sourceDirectory === './src')
    {
      // 默认情况下，尝试两种路径解析方式
      targetFilePath = path.resolve(this.config.sourceDirectory, filePath)

      // 如果在 src 目录中找不到，尝试相对于项目根目录的路径
      if (!(await this.checkFileExists(targetFilePath)))
      {
        targetFilePath = path.resolve('.', filePath)
      }
    }
    else
    {
      targetFilePath = path.resolve('.', filePath)
    }

    // 检查目标文件是否存在
    if (!(await this.checkFileExists(targetFilePath)))
    {
      this.stats.skippedItems.push({
        code: item.code,
        filePath,
        reason: '文件不存在',
      })
      this.logger.warn(`跳过词条 ${item.code}: 文件不存在 ${filePath}`)
      return
    }

    // 执行文本替换
    const success = await this.replaceTextInFile(
      targetFilePath,
      item['label_zh-cn'],
      item.code,
    )

    if (success)
    {
      this.stats.successfulReplacements++
      const action = this.config.dryRun ? '预览替换' : '成功替换'
      this.logger.success(`${action} - 文件: ${filePath}, 文本: "${item['label_zh-cn']}" -> $t('${item.code}')`)
    }
    else
    {
      this.stats.failedReplacements.push({
        code: item.code,
        filePath,
        searchText: item['label_zh-cn'],
        reason: '未找到匹配的文本',
      })
      this.logger.warn(`替换失败 - 词条: ${item.code}, 文件: ${filePath}, 文本: "${item['label_zh-cn']}"`)
    }
  }

  /**
   * 生成替换报告
   */
  private generateReport(): void
  {
    console.log(`\n${'='.repeat(80)}`)
    console.log('国际化静态文本替换报告')
    console.log('='.repeat(80))
    console.log(`模式: ${this.config.dryRun ? '预览模式（未实际修改文件）' : '执行模式'}`)
    console.log(`处理词条总数: ${this.stats.totalItems}`)
    console.log(`处理文件总数: ${this.stats.totalFiles}`)
    console.log(`成功替换次数: ${this.stats.successfulReplacements}`)
    console.log(`失败替换次数: ${this.stats.failedReplacements.length}`)
    console.log(`跳过文件次数: ${this.stats.skippedItems.length}`)

    if (this.stats.failedReplacements.length > 0)
    {
      console.log('\n失败的替换记录:')
      this.stats.failedReplacements.forEach((item, index) =>
      {
        console.log(`${index + 1}. 词条: ${item.code}`)
        console.log(`   文件: ${item.filePath}`)
        console.log(`   文本: "${item.searchText}"`)
        console.log(`   原因: ${item.reason}\n`)
      })
    }

    if (this.stats.skippedItems.length > 0)
    {
      console.log('\n跳过的词条记录:')
      this.stats.skippedItems.forEach((item, index) =>
      {
        console.log(`${index + 1}. 词条: ${item.code}`)
        console.log(`   文件: ${item.filePath}`)
        console.log(`   原因: ${item.reason}\n`)
      })
    }

    console.log('='.repeat(80))
  }

  /**
   * 运行替换工具
   */
  async run(): Promise<void>
  {
    try
    {
      this.logger.info('开始执行国际化静态文本替换工具...')
      this.logger.info(`语言文件路径: ${this.config.languageFilePath}`)
      this.logger.info(`源代码目录: ${this.config.sourceDirectory}`)
      this.logger.info(`运行模式: ${this.config.dryRun ? '预览模式' : '执行模式'}`)

      // 1. 读取语言文件
      const languageItems = await this.loadLanguageFile()

      // 2. 过滤静态文本词条
      const staticItems = this.filterStaticTextItems(languageItems)
      this.stats.totalItems = staticItems.length

      if (staticItems.length === 0)
      {
        this.logger.warn('没有找到需要处理的静态文本词条')
        return
      }

      // 3. 逐一处理词条
      this.logger.info(`开始处理 ${staticItems.length} 个静态文本词条...`)

      for (let i = 0; i < staticItems.length; i++)
      {
        const item = staticItems[i]
        this.logger.info(`处理进度: ${i + 1}/${staticItems.length} - ${item.code}`)
        await this.processLanguageItem(item)
      }

      // 4. 生成报告
      this.generateReport()

      this.logger.info('国际化静态文本替换工具执行完成!')
    }
    catch (error)
    {
      this.logger.error(`工具执行失败: ${error}`)
      throw error
    }
  }
}

/**
 * 主函数 - 解析命令行参数并运行工具
 */
async function main()
{
  // 解析命令行参数
  const args = process.argv.slice(2)

  // 默认配置
  const config: IReplacementConfig = {
    languageFilePath: './lang/index-sorted-new.json',
    sourceDirectory: './src',
    debug: false,
    dryRun: true, // 默认为预览模式，确保安全
  }

  // 解析参数
  for (let i = 0; i < args.length; i++)
  {
    switch (args[i])
    {
      case '--lang-file':
      case '-l': {
        config.languageFilePath = args[++i]
        break
      }
      case '--source-dir':
      case '-s': {
        config.sourceDirectory = args[++i]
        break
      }
      case '--debug':
      case '-d': {
        config.debug = true
        break
      }
      case '--execute':
      case '-e': {
        config.dryRun = false
        break
      }
      case '--help':
      case '-h': {
        console.log(`
国际化静态文本替换工具使用说明:

参数说明:
  -l, --lang-file <path>    指定语言JSON文件路径 (默认: ./lang/index-sorted-new.json)
  -s, --source-dir <path>   指定源代码目录路径 (默认: ./src)
  -d, --debug              启用调试模式
  -e, --execute            执行模式（默认为预览模式，不实际修改文件）
  -h, --help               显示帮助信息

使用示例:
  # 预览模式（默认，不修改文件）
  npm run i18n:replace

  # 预览模式，指定自定义路径
  npm run i18n:replace -- -l ./custom-lang.json -s ./custom-src

  # 执行模式（实际修改文件）
  npm run i18n:replace -- -e

  # 执行模式，指定自定义路径
  npm run i18n:replace -- -l ./lang/index-sorted-new.json -s ./src -e

注意: 建议先在预览模式下检查结果，确认无误后再使用执行模式。
        `)
        return
      }
    }
  }

  // 运行工具
  const replacer = new I18nStaticTextReplacer(config)
  await replacer.run()
}

// 如果是直接运行此文件，则执行main函数
if (require.main === module)
{
  try
  {
    await main()
    process.exit(0)
  }
  catch (error)
  {
    console.error('工具执行失败:', error)
    process.exit(1)
  }
}

export { I18nStaticTextReplacer, type ILanguageItem, type IReplacementConfig }
