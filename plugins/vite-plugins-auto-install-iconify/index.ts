import fs from 'fs-extra'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { lookupCollection, lookupCollections } from '@iconify/json'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 插件配置选项
 */
interface PluginOptions {
  /** 应用编码，用于缓存隔离，当 generateLoader 为 true 时必填 */
  appCode?: string
  /** 缓存版本号，用于缓存失效控制，默认 '1.0.0' */
  cacheVersion?: string
  /** 图标数据文件输出路径，默认 'src/iconify/data.json' */
  dataOutputPath?: string
  /** 是否启用本地缓存，默认 true */
  enableCache?: boolean
  /** 排除扫描的路径模式数组，默认 ['node_modules'] */
  excludes?: string[]
  /** 是否从API获取本地缺失的图标，默认 true */
  fetchMissingIcons?: boolean
  /** 是否生成图标加载器代码，默认 true */
  generateLoader?: boolean
  /** 图标输出目录，默认 'public/icons' */
  iconOutputDir?: string
  /** 图标匹配的正则表达式模式，用于识别代码中的图标引用 */
  iconPattern?: string
  /** 需要忽略的图标前缀，默认 'i-' */
  iconPrefixToIgnore?: string
  /** 需要扫描的文件扩展名数组，默认 ['.ts', '.vue'] */
  includes?: string[]
  /** 元数据文件输出路径，默认 'src/iconify/index.json' */
  metaOutputPath?: string
  /** 是否只打包实际使用的图标，默认 true */
  onlyUsedIcons?: boolean
  /** 是否验证官方API，确保只使用官方图标集，默认 true */
  validateWithOfficialAPI?: boolean
}

/**
 * 图标引用信息
 */
interface IconReference {
  /** 完整图标标识符，格式为 'prefix:name' */
  fullName: string
  /** 图标名称，如 'home', 'user' 等 */
  name: string
  /** 图标集前缀，如 'mdi', 'carbon' 等 */
  prefix: string
}

/**
 * 图标集元数据
 */
interface IconSetMeta {
  /** 图标数据文件的哈希值，用于缓存版本控制 */
  hash: string
  /** 该图标集中使用的所有图标名称列表 */
  icons: string[]
  /** 图标集信息，包含名称等 */
  info: { name: string }
  /** 图标集前缀 */
  prefix: string
}

/**
 * 图标集数据结构
 */
interface IconSetData {
  /** 别名映射，键为别名，值为别名定义 */
  aliases?: Record<string, unknown>
  /** 默认高度 */
  height?: number
  /** 图标数据映射，键为图标名称，值为图标定义 */
  icons: Record<string, unknown>
  /** 图标集元信息 */
  info?: { name: string }
  /** 图标集前缀 */
  prefix: string
  /** 默认宽度 */
  width?: number
  /** 其他扩展字段 */
  [key: string]: unknown
}

/**
 * API响应数据结构
 */
interface APIResponse {
  /** 别名映射 */
  aliases?: Record<string, { parent: string }>
  /** 默认高度 */
  height?: number
  /** 图标数据映射 */
  icons?: Record<string, unknown>
  /** 图标集信息 */
  info?: { name: string }
  /** 默认宽度 */
  width?: number
}

/**
 * 图标处理结果
 */
interface ProcessResult {
  /** 找到的图标数量 */
  foundCount: number
  /** 缺失的图标名称列表 */
  missingIcons: string[]
}

/**
 * 本地图标集加载结果
 */
interface LocalIconSetLoadResult {
  /** 完整的图标集数据 */
  fullSetData: IconSetData | null
  /** 是否存在本地数据 */
  hasLocalData: boolean
}

// ============================================================================
// 主插件函数
// ============================================================================

/**
 * 自动分析SVG图标前缀的Vite插件
 * 此插件会扫描指定文件类型中使用的Iconify图标，
 * 并生成离线可用的图标数据(只包含实际使用的图标)
 *
 * @param options 插件配置选项
 * @returns Vite插件实例
 */
export default function autoInstallIconifyPlugin(options: PluginOptions = {})
{
  // 初始化配置
  const config = initializeConfig(options)

  // 状态存储
  const usedIcons = new Map<string, Set<string>>()
  const iconReferences: IconReference[] = []
  const officialIconCollections: Record<string, unknown> | null = null

  return {
    name: 'vite-plugin-auto-install-iconify',
    enforce: 'pre' as const,

    async buildStart()
    {
      console.log('[icon analysis] 开始分析项目中使用的图标...')

      await initializeOfficialCollections(config, officialIconCollections)
      await analyzeAndGenerateIcons(config, usedIcons, iconReferences, officialIconCollections)
    },

    async buildEnd()
    {
      if (usedIcons.size > 0)
      {
        console.log(`[icon analysis] 构建完成，已处理 ${usedIcons.size} 个图标集`)
      }
    },
  }
}

// ============================================================================
// 配置初始化模块
// ============================================================================

/**
 * 初始化插件配置，为未提供的选项设置默认值
 *
 * @param options 用户提供的配置选项
 * @returns 完整的配置对象
 */
function initializeConfig(options: PluginOptions): Required<PluginOptions>
{
  return {
    appCode: options.appCode ?? '',
    includes: options.includes ?? ['.ts', '.vue'],
    excludes: options.excludes ?? ['node_modules'],
    iconOutputDir: options.iconOutputDir ?? 'public/icons',
    metaOutputPath: options.metaOutputPath ?? 'src/iconify/index.json',
    dataOutputPath: options.dataOutputPath ?? 'src/iconify/data.json',
    iconPattern: options.iconPattern ?? String.raw`["']{1}([a-zA-Z0-9-]+):([^"'\s]+)["']{1}`,
    iconPrefixToIgnore: options.iconPrefixToIgnore ?? 'i-',
    validateWithOfficialAPI: options.validateWithOfficialAPI ?? true,
    onlyUsedIcons: options.onlyUsedIcons ?? true,
    fetchMissingIcons: options.fetchMissingIcons ?? true,
    enableCache: options.enableCache ?? true,
    cacheVersion: options.cacheVersion ?? '1.0.0',
    generateLoader: options.generateLoader ?? true,
  }
}

// ============================================================================
// 官方API集成模块
// ============================================================================

/**
 * 从Iconify官方API获取所有官方图标集列表
 *
 * @param config 插件配置
 * @param officialIconCollections 官方图标集列表的引用，会被更新
 */
async function initializeOfficialCollections(
  config: Required<PluginOptions>,
  officialIconCollections: Record<string, unknown> | null,
): Promise<void>
{
  if (!config.validateWithOfficialAPI) return

  try
  {
    console.log('[icon analysis] 正在从Iconify API获取官方图标集列表...')
    const response = await fetch('https://api.iconify.design/collections')

    if (response.ok)
    {
      officialIconCollections = await response.json()
      console.log(`[icon analysis] 成功获取 ${Object.keys(officialIconCollections || {}).length} 个官方图标集列表`)
    }
    else
    {
      console.warn(`[icon analysis] 获取官方图标集列表失败: ${response.statusText}`)
    }
  }
  catch (error)
  {
    console.warn('[icon analysis] 获取官方图标集列表出错:', error)
  }
}

// ============================================================================
// 图标分析与生成主流程
// ============================================================================

/**
 * 分析项目文件并生成图标数据
 *
 * @param config 插件配置
 * @param usedIcons 已使用的图标集合
 * @param iconReferences 图标引用列表
 * @param officialIconCollections 官方图标集列表
 */
async function analyzeAndGenerateIcons(
  config: Required<PluginOptions>,
  usedIcons: Map<string, Set<string>>,
  iconReferences: IconReference[],
  officialIconCollections: Record<string, unknown> | null,
): Promise<void>
{
  try
  {
    const projectRoot = process.cwd()
    const filesToScan = await scanProjectFiles(projectRoot, config.includes, config.excludes)
    console.log(`[icon analysis] 找到 ${filesToScan.length} 个文件需要分析`)

    // 分析所有文件
    for (const filePath of filesToScan)
    {
      const fileIconReferences = await analyzeFileForIcons(
        filePath,
        config.iconPattern,
        config.iconPrefixToIgnore,
        officialIconCollections,
        config.validateWithOfficialAPI,
      )

      iconReferences.push(...fileIconReferences)
      updateUsedIconsMap(usedIcons, fileIconReferences)
    }

    // 生成图标文件
    await processAndGenerateIcons(config, usedIcons)
  }
  catch (error)
  {
    console.error('[icon analysis] 项目文件分析失败:', error)
  }
}

/**
 * 更新已使用图标映射表
 *
 * @param usedIcons 已使用图标映射表
 * @param references 图标引用列表
 */
function updateUsedIconsMap(usedIcons: Map<string, Set<string>>, references: IconReference[]): void
{
  for (const ref of references)
  {
    if (!usedIcons.has(ref.prefix))
    {
      usedIcons.set(ref.prefix, new Set())
    }
    usedIcons.get(ref.prefix)!.add(ref.name)
  }
}

// ============================================================================
// 文件扫描模块
// ============================================================================

/**
 * 递归扫描目录，获取所有需要分析的文件
 *
 * @param dirPath 目录路径
 * @param includes 需要扫描的文件扩展名数组
 * @param excludes 排除扫描的路径模式数组
 * @returns 文件路径数组
 */
async function scanProjectFiles(
  dirPath: string,
  includes: string[],
  excludes: string[],
): Promise<string[]>
{
  const files: string[] = []

  async function walkDirectory(currentPath: string): Promise<void>
  {
    try
    {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries)
      {
        const fullPath = path.join(currentPath, entry.name)

        if (shouldExclude(fullPath, excludes)) continue

        if (entry.isDirectory())
        {
          await walkDirectory(fullPath)
        }
        else if (entry.isFile() && matchesExtension(fullPath, includes))
        {
          files.push(fullPath)
        }
      }
    }
    catch (error)
    {
      console.warn(`[icon analysis] 扫描目录 ${currentPath} 时出错:`, error)
    }
  }

  await walkDirectory(dirPath)
  return files
}

/**
 * 检查文件路径是否应该被排除
 *
 * @param filePath 文件路径
 * @param excludes 排除模式列表
 * @returns 是否应该排除
 */
function shouldExclude(filePath: string, excludes: string[]): boolean
{
  return excludes.some(exclude => filePath.includes(exclude))
}

/**
 * 检查文件扩展名是否匹配
 *
 * @param filePath 文件路径
 * @param includes 包含的扩展名列表
 * @returns 是否匹配
 */
function matchesExtension(filePath: string, includes: string[]): boolean
{
  return includes.some(ext => filePath.endsWith(ext))
}

// ============================================================================
// 文件内容分析模块
// ============================================================================

/**
 * 分析文件内容，提取图标引用
 *
 * @param filePath 文件路径
 * @param iconPattern 图标匹配模式
 * @param iconPrefixToIgnore 图标前缀忽略配置
 * @param officialIconCollections 官方图标集列表
 * @param validateWithOfficialAPI 是否验证官方API
 * @returns 图标引用数组
 */
async function analyzeFileForIcons(
  filePath: string,
  iconPattern: string,
  iconPrefixToIgnore: string,
  officialIconCollections: Record<string, unknown> | null,
  validateWithOfficialAPI: boolean,
): Promise<IconReference[]>
{
  try
  {
    const content = await fs.readFile(filePath, 'utf8')
    const iconRegex = new RegExp(iconPattern, 'g')
    const matches = [...content.matchAll(iconRegex)]

    const references: IconReference[] = []

    for (const match of matches)
    {
      if (match.length < 3) continue

      const reference = extractIconReference(
        match[1], match[2], iconPrefixToIgnore,
        officialIconCollections, validateWithOfficialAPI,
      )

      if (reference)
      {
        references.push(reference)
      }
    }

    return references
  }
  catch (error)
  {
    console.warn(`[icon analysis] 分析文件 ${filePath} 时出错:`, error)
    return []
  }
}

/**
 * 从匹配结果中提取图标引用
 *
 * @param rawPrefix 原始前缀
 * @param name 图标名称
 * @param iconPrefixToIgnore 需要忽略的前缀
 * @param officialIconCollections 官方图标集列表
 * @param validateWithOfficialAPI 是否验证官方API
 * @returns 图标引用对象或null
 */
function extractIconReference(
  rawPrefix: string,
  name: string,
  iconPrefixToIgnore: string,
  officialIconCollections: Record<string, unknown> | null,
  validateWithOfficialAPI: boolean,
): IconReference | null
{
  // 跳过URL模式
  if (name.includes('/') || name.startsWith('//') || name.startsWith('http'))
  {
    return null
  }

  // 处理前缀
  let prefix = rawPrefix
  if (iconPrefixToIgnore && prefix.startsWith(iconPrefixToIgnore))
  {
    prefix = prefix.slice(iconPrefixToIgnore.length)
    console.log(`[icon analysis] 处理图标库名称忽略前缀: ${rawPrefix} -> ${prefix}`)
  }

  if (!prefix) return null

  // 验证是否为官方图标集
  if (validateWithOfficialAPI && officialIconCollections && !officialIconCollections[prefix])
  {
    return null
  }

  return {
    prefix,
    name,
    fullName: `${prefix}:${name}`,
  }
}

// ============================================================================
// 图标生成主流程
// ============================================================================

/**
 * 处理图标数据并生成相关文件
 *
 * @param config 插件配置
 * @param usedIcons 已使用的图标集合
 */
async function processAndGenerateIcons(
  config: Required<PluginOptions>,
  usedIcons: Map<string, Set<string>>,
): Promise<void>
{
  if (usedIcons.size === 0)
  {
    console.warn('[icon analysis] 未在项目中找到图标。')
    return
  }

  logUsedIconsSummary(usedIcons)

  // 生成元数据文件
  await generateMetaFile(config.metaOutputPath, usedIcons)

  // 准备输出目录
  const outputDir = path.resolve(process.cwd(), config.iconOutputDir)
  await fs.ensureDir(outputDir)
  await fs.emptyDir(outputDir)

  // 处理每个图标集
  const collectionsMeta: IconSetMeta[] = []

  for (const [prefix, iconNames] of usedIcons.entries())
  {
    const meta = await processIconSet(
      prefix, iconNames, outputDir,
      config.onlyUsedIcons, config.fetchMissingIcons,
    )

    if (meta)
    {
      collectionsMeta.push(meta)
    }
  }

  // 保存数据文件
  await fs.writeJSON(path.resolve(process.cwd(), config.dataOutputPath), collectionsMeta)

  // 生成加载器
  if (config.generateLoader)
  {
    if (!config.appCode)
    {
      throw new Error('当 generateLoader 为 true 时，appCode 参数是必填的')
    }
    await generateIconifyLoader(
      config.metaOutputPath,
      config.dataOutputPath,
      config.enableCache,
      config.cacheVersion,
      config.appCode,
    )
  }

  console.log(`[icon analysis] 完成: 所有图标数据已导出到 ${config.iconOutputDir}`)
}

/**
 * 输出已使用图标的摘要信息
 *
 * @param usedIcons 已使用的图标集合
 */
function logUsedIconsSummary(usedIcons: Map<string, Set<string>>): void
{
  const summary = [...usedIcons.entries()].map(
    ([prefix, icons]) => `${prefix}(${icons.size}个图标)`,
  )
  console.log(`[icon analysis] 使用的图标集: \n${summary.join(', \n')}`)
}

/**
 * 生成元数据文件
 *
 * @param metaOutputPath 元数据文件输出路径
 * @param usedIcons 已使用的图标集合
 */
async function generateMetaFile(
  metaOutputPath: string,
  usedIcons: Map<string, Set<string>>,
): Promise<void>
{
  await fs.writeJSON(path.resolve(process.cwd(), metaOutputPath), {
    collections: [...usedIcons.keys()],
    useType: 'offline',
  })
}

// ============================================================================
// 图标集处理模块
// ============================================================================

/**
 * 处理单个图标集
 *
 * @param prefix 图标集前缀
 * @param iconNames 图标名称集合
 * @param outputDir 输出目录
 * @param onlyUsedIcons 是否只打包使用的图标
 * @param fetchMissingIcons 是否尝试获取缺失的图标
 * @returns 图标集元数据，处理失败返回null
 */
async function processIconSet(
  prefix: string,
  iconNames: Set<string>,
  outputDir: string,
  onlyUsedIcons: boolean,
  fetchMissingIcons: boolean,
): Promise<IconSetMeta | null>
{
  // 加载本地数据
  const { hasLocalData, fullSetData } = await loadLocalIconSet(prefix)

  // 准备数据容器
  const usedIconsData = prepareIconDataContainer(prefix, hasLocalData, fullSetData, onlyUsedIcons)

  // 处理图标
  const processingResult = await processIconsInSet(
    prefix, iconNames, hasLocalData, fullSetData, usedIconsData,
    onlyUsedIcons, fetchMissingIcons,
  )

  if (processingResult.foundCount === 0)
  {
    console.warn(`[icon analysis] 警告: 图标集 ${prefix} 中没有找到任何可用图标，跳过生成`)
    return null
  }

  // 保存文件
  return await saveIconSetFiles(
    prefix, usedIconsData, fullSetData,
    outputDir, onlyUsedIcons, processingResult.foundCount, hasLocalData,
  )
}

/**
 * 从本地加载图标集数据
 *
 * @param prefix 图标集前缀
 * @returns 本地图标集加载结果
 */
async function loadLocalIconSet(prefix: string): Promise<LocalIconSetLoadResult>
{
  const allCollections = await lookupCollections()

  if (allCollections && allCollections[prefix])
  {
    const fullSetData = await lookupCollection(prefix)
    return { hasLocalData: true, fullSetData: fullSetData as IconSetData }
  }

  console.log(`[icon analysis] 警告: 本地未找到图标集 ${prefix}`)
  return { hasLocalData: false, fullSetData: null }
}

/**
 * 准备图标数据容器
 *
 * @param prefix 图标集前缀
 * @param hasLocalData 是否有本地数据
 * @param fullSetData 完整图标集数据
 * @param onlyUsedIcons 是否只打包使用的图标
 * @returns 图标数据容器
 */
function prepareIconDataContainer(
  prefix: string,
  hasLocalData: boolean,
  fullSetData: IconSetData | null,
  onlyUsedIcons: boolean,
): IconSetData
{
  if (hasLocalData && onlyUsedIcons)
  {
    // 创建精简版数据容器
    const usedData: IconSetData = {
      prefix,
      icons: {},
    }

    if (fullSetData?.aliases)
    {
      usedData.aliases = {}
    }

    return usedData
  }
  else if (hasLocalData && fullSetData)
  {
    // 深拷贝完整数据
    return structuredClone(fullSetData)
  }
  else
  {
    // 创建空容器
    return {
      prefix,
      icons: {},
    }
  }
}

/**
 * 处理图标集中的所有图标
 *
 * @param prefix 图标集前缀
 * @param iconNames 图标名称集合
 * @param hasLocalData 是否有本地数据
 * @param fullSetData 完整图标集数据
 * @param usedIconsData 使用的图标数据容器
 * @param onlyUsedIcons 是否只打包使用的图标
 * @param fetchMissingIcons 是否尝试获取缺失的图标
 * @returns 处理结果
 */
async function processIconsInSet(
  prefix: string,
  iconNames: Set<string>,
  hasLocalData: boolean,
  fullSetData: IconSetData | null,
  usedIconsData: IconSetData,
  onlyUsedIcons: boolean,
  fetchMissingIcons: boolean,
): Promise<ProcessResult>
{
  const missingIcons: string[] = []
  let foundCount = 0

  if (hasLocalData && fullSetData)
  {
    const parentIconsToAdd = new Set<string>()

    // 处理本地图标
    for (const iconName of iconNames)
    {
      const result = processLocalIcon(
        iconName, fullSetData, usedIconsData,
        onlyUsedIcons, parentIconsToAdd,
      )

      if (result.found)
      {
        foundCount++
      }
      else
      {
        missingIcons.push(iconName)
      }
    }

    // 添加别名依赖的父图标
    foundCount += await addParentIcons(
      parentIconsToAdd, fullSetData, usedIconsData, onlyUsedIcons, missingIcons,
    )
  }
  else
  {
    // 所有图标都标记为丢失
    missingIcons.push(...iconNames)
  }

  // 处理丢失的图标
  if (missingIcons.length > 0 && fetchMissingIcons)
  {
    const recovered = await fetchMissingIconsFromAPI(
      prefix, missingIcons, usedIconsData, onlyUsedIcons,
    )
    foundCount += recovered
  }
  else if (missingIcons.length > 0)
  {
    logMissingIcons(prefix, missingIcons)
  }

  return { foundCount, missingIcons }
}

/**
 * 处理单个本地图标
 *
 * @param iconName 图标名称
 * @param fullSetData 完整图标集数据
 * @param usedIconsData 使用的图标数据容器
 * @param onlyUsedIcons 是否只打包使用的图标
 * @param parentIconsToAdd 需要添加的父图标集合
 * @returns 处理结果
 */
function processLocalIcon(
  iconName: string,
  fullSetData: IconSetData,
  usedIconsData: IconSetData,
  onlyUsedIcons: boolean,
  parentIconsToAdd: Set<string>,
): { found: boolean }
{
  // 检查是否为直接图标
  if (fullSetData.icons?.[iconName])
  {
    if (onlyUsedIcons)
    {
      usedIconsData.icons[iconName] = fullSetData.icons[iconName]
    }
    return { found: true }
  }

  // 检查是否为别名
  if (fullSetData.aliases?.[iconName])
  {
    const aliasData = fullSetData.aliases[iconName]
    const parentIcon = (aliasData as { parent: string }).parent

    if (onlyUsedIcons)
    {
      if (!usedIconsData.aliases) usedIconsData.aliases = {}
      usedIconsData.aliases[iconName] = aliasData
      parentIconsToAdd.add(parentIcon)
    }

    console.log(`[icon analysis] 图标 "${fullSetData.prefix}:${iconName}" 是别名，指向 "${fullSetData.prefix}:${parentIcon}"`)
    return { found: true }
  }

  return { found: false }
}

/**
 * 添加别名依赖的父图标
 *
 * @param parentIconsToAdd 需要添加的父图标集合
 * @param fullSetData 完整图标集数据
 * @param usedIconsData 使用的图标数据容器
 * @param onlyUsedIcons 是否只打包使用的图标
 * @param missingIcons 缺失图标列表
 * @returns 添加的父图标数量
 */
async function addParentIcons(
  parentIconsToAdd: Set<string>,
  fullSetData: IconSetData,
  usedIconsData: IconSetData,
  onlyUsedIcons: boolean,
  missingIcons: string[],
): Promise<number>
{
  let addedCount = 0

  for (const parentIcon of parentIconsToAdd)
  {
    if (fullSetData.icons?.[parentIcon])
    {
      if (onlyUsedIcons)
      {
        usedIconsData.icons[parentIcon] = fullSetData.icons[parentIcon]
      }
      addedCount++
      console.log(`[icon analysis] 已添加别名依赖的父图标: "${fullSetData.prefix}:${parentIcon}"`)
    }
    else
    {
      console.warn(`[icon analysis] 警告: 别名依赖的父图标 "${fullSetData.prefix}:${parentIcon}" 在本地图标集中不存在`)
      missingIcons.push(parentIcon)
    }
  }

  return addedCount
}

/**
 * 从API获取缺失的图标
 *
 * @param prefix 图标集前缀
 * @param missingIcons 缺失的图标名称列表
 * @param usedIconsData 使用的图标数据容器
 * @param onlyUsedIcons 是否只打包使用的图标
 * @returns 成功获取的图标数量
 */
async function fetchMissingIconsFromAPI(
  prefix: string,
  missingIcons: string[],
  usedIconsData: IconSetData,
  onlyUsedIcons: boolean,
): Promise<number>
{
  console.log(`[icon analysis] 正在尝试从Iconify API获取 ${missingIcons.length} 个丢失的 ${prefix} 图标...`)
  console.log('[icon analysis] 丢失的图标', missingIcons)

  const apiUrl = `https://api.iconify.design/${prefix}.json?icons=${missingIcons.join(',')}`
  console.log('[icon analysis] API URL', apiUrl)

  try
  {
    const response = await fetch(apiUrl)

    if (!response.ok)
    {
      console.warn(`[icon analysis] 警告: 从Iconify API获取 ${prefix} 图标失败: ${response.statusText}`)
      logMissingIcons(prefix, missingIcons)
      return 0
    }

    const apiData: APIResponse = await response.json()
    const recovered = processAPIResponse(prefix, apiData, missingIcons, usedIconsData, onlyUsedIcons)

    console.log(`[icon analysis] 已成功从API获取 ${recovered}/${missingIcons.length} 个 ${prefix} 图标`)

    // 更新元数据
    updateIconSetMetadata(apiData, usedIconsData)

    // 输出仍未找到的图标
    const notFoundIcons = findNotFoundIcons(missingIcons, apiData)
    if (notFoundIcons.length > 0)
    {
      logMissingIcons(prefix, notFoundIcons)
    }

    return recovered
  }
  catch (error)
  {
    console.error('[icon analysis] 从Iconify API获取图标时出错:', error)
    logMissingIcons(prefix, missingIcons)
    return 0
  }
}

/**
 * 处理API响应数据
 *
 * @param prefix 图标集前缀
 * @param apiData API响应数据
 * @param missingIcons 缺失的图标名称列表
 * @param usedIconsData 使用的图标数据容器
 * @param onlyUsedIcons 是否只打包使用的图标
 * @returns 成功恢复的图标数量
 */
function processAPIResponse(
  prefix: string,
  apiData: APIResponse,
  missingIcons: string[],
  usedIconsData: IconSetData,
  onlyUsedIcons: boolean,
): number
{
  let recoveredCount = 0

  // 处理直接图标
  if (apiData.icons)
  {
    for (const missingIcon of missingIcons)
    {
      if (apiData.icons[missingIcon])
      {
        if (onlyUsedIcons)
        {
          usedIconsData.icons[missingIcon] = apiData.icons[missingIcon]
        }
        recoveredCount++
      }
    }
  }

  // 处理别名图标
  if (apiData.aliases)
  {
    for (const missingIcon of missingIcons)
    {
      if (apiData.aliases[missingIcon])
      {
        const aliasData = apiData.aliases[missingIcon] as any
        const parentIcon = aliasData.parent

        if (onlyUsedIcons)
        {
          if (!usedIconsData.aliases) usedIconsData.aliases = {}
          usedIconsData.aliases[missingIcon] = aliasData
        }

        // 确保父图标数据也被包含
        if (apiData.icons && apiData.icons[parentIcon])
        {
          if (onlyUsedIcons)
          {
            usedIconsData.icons[parentIcon] = apiData.icons[parentIcon]
          }
        }
        else
        {
          console.warn(`[icon analysis] 警告: 别名 "${prefix}:${missingIcon}" 的父图标 "${prefix}:${parentIcon}" 在API响应中未找到`)
        }

        recoveredCount++
        console.log(`[icon analysis] 从API获取的图标 "${prefix}:${missingIcon}" 是别名，指向 "${prefix}:${parentIcon}"`)
      }
    }
  }

  return recoveredCount
}

/**
 * 更新图标集元数据
 *
 * @param apiData API响应数据
 * @param usedIconsData 使用的图标数据容器
 */
function updateIconSetMetadata(apiData: APIResponse, usedIconsData: IconSetData): void
{
  if (apiData.width) usedIconsData.width = apiData.width
  if (apiData.height) usedIconsData.height = apiData.height
  if (apiData.info) usedIconsData.info = apiData.info
}

/**
 * 查找未找到的图标
 *
 * @param missingIcons 缺失的图标列表
 * @param apiData API响应数据
 * @returns 仍未找到的图标列表
 */
function findNotFoundIcons(missingIcons: string[], apiData: APIResponse): string[]
{
  return missingIcons.filter(name =>
    !apiData.icons?.[name] && !apiData.aliases?.[name],
  )
}

/**
 * 记录缺失的图标警告
 *
 * @param prefix 图标集前缀
 * @param icons 缺失的图标名称列表
 */
function logMissingIcons(prefix: string, icons: string[]): void
{
  for (const icon of icons)
  {
    console.warn(`[icon analysis] 警告: 图标 "${prefix}:${icon}" 在图标集中不存在`)
  }
}

// ============================================================================
// 文件保存模块
// ============================================================================

/**
 * 保存图标集文件
 *
 * @param prefix 图标集前缀
 * @param usedIconsData 使用的图标数据
 * @param fullSetData 完整图标集数据
 * @param outputDir 输出目录
 * @param onlyUsedIcons 是否只打包使用的图标
 * @param foundCount 找到的图标数量
 * @param hasLocalData 是否有本地数据
 * @returns 图标集元数据
 */
async function saveIconSetFiles(
  prefix: string,
  usedIconsData: IconSetData,
  fullSetData: IconSetData | null,
  outputDir: string,
  onlyUsedIcons: boolean,
  foundCount: number,
  hasLocalData: boolean,
): Promise<IconSetMeta>
{
  // 优化数据
  const dataToSave = optimizeIconData(usedIconsData)
  const offlineFilePath = path.join(outputDir, `${prefix}-raw.json`)
  await fs.writeJSON(offlineFilePath, dataToSave)

  // 计算文件哈希
  const fileHash = calculateFileHash(dataToSave)

  // 构建元数据
  const metaData: IconSetMeta = {
    prefix,
    info: usedIconsData.info || { name: prefix },
    icons: extractIconNames(usedIconsData),
    hash: fileHash,
  }

  // 输出统计信息
  logIconSetStats(prefix, fullSetData, dataToSave, onlyUsedIcons, hasLocalData, foundCount, fileHash)

  return metaData
}

/**
 * 计算文件内容的哈希值
 *
 * @param data 要计算哈希的数据
 * @returns 8位哈希值
 */
function calculateFileHash(data: any): string
{
  const content = JSON.stringify(data)
  return createHash('md5').update(content).digest('hex').slice(0, 8)
}

/**
 * 提取图标名称列表
 *
 * @param iconData 图标数据
 * @returns 图标名称列表（包括直接图标和别名）
 */
function extractIconNames(iconData: IconSetData): string[]
{
  const names: string[] = []

  if (iconData.icons)
  {
    names.push(...Object.keys(iconData.icons))
  }

  if (iconData.aliases)
  {
    names.push(...Object.keys(iconData.aliases))
  }

  return names
}

/**
 * 输出图标集统计信息
 *
 * @param prefix 图标集前缀
 * @param fullSetData 完整图标集数据
 * @param dataToSave 保存的数据
 * @param onlyUsedIcons 是否只打包使用的图标
 * @param hasLocalData 是否有本地数据
 * @param foundCount 找到的图标数量
 * @param fileHash 文件哈希值
 */
function logIconSetStats(
  prefix: string,
  fullSetData: IconSetData | null,
  dataToSave: any,
  onlyUsedIcons: boolean,
  hasLocalData: boolean,
  foundCount: number,
  fileHash: string,
): void
{
  const finalSize = JSON.stringify(dataToSave).length
  const fullSize = fullSetData ? JSON.stringify(fullSetData).length : 0

  if (onlyUsedIcons && fullSize > 0)
  {
    const totalSavingPercent = ((fullSize - finalSize) / fullSize * 100).toFixed(2)
    console.log(`[icon analysis] 图标集 ${prefix}: 完整图标集 ${formatSize(fullSize)} → 优化后 ${formatSize(finalSize)} (hash: ${fileHash})`)
    console.log(`[icon analysis] 总节省: ${totalSavingPercent}%, 使用了${foundCount}个图标`)
  }
  else
  {
    console.log(`[icon analysis] 图标集 ${prefix}: 使用${hasLocalData ? '完整' : 'API获取的'}图标集 ${formatSize(finalSize)}, 使用了${foundCount}个图标 (hash: ${fileHash})`)
  }
}

/**
 * 格式化文件大小
 *
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
function formatSize(bytes: number): string
{
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ============================================================================
// 数据优化模块
// ============================================================================

/**
 * 优化图标数据，移除对渲染无影响的元数据字段以减少文件大小
 *
 * @param iconData 原始图标数据
 * @returns 优化后的图标数据
 */
function optimizeIconData(iconData: IconSetData): any
{
  const optimizedData = structuredClone(iconData)

  // 删除对图标渲染无影响的元数据字段
  const fieldsToRemove = [
    'info', // 图标集信息
    'categories', // 分类信息
    'total', // 总数
    'version', // 版本号
    'samples', // 示例
    'displayHeight', // 显示高度
    'category', // 类别
    'tags', // 标签
    'palette', // 调色板信息
    'chars', // 字符映射
    'suffixes', // 后缀
    'prefixes', // 前缀
  ]

  fieldsToRemove.forEach((field) =>
  {
    if (optimizedData[field] !== undefined)
    {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete optimizedData[field]
    }
  })

  return optimizedData
}

// ============================================================================
// 加载器生成模块
// ============================================================================

/**
 * 生成带缓存机制的Iconify加载器代码
 *
 * @param metaOutputPath 元数据文件路径
 * @param dataOutputPath 数据文件路径
 * @param enableCache 是否启用缓存
 * @param cacheVersion 缓存版本号
 * @param appCode 应用编码
 */
async function generateIconifyLoader(
  metaOutputPath: string,
  dataOutputPath: string,
  enableCache: boolean,
  cacheVersion: string,
  appCode: string,
): Promise<void>
{
  const loaderCode = generateLoaderCode(metaOutputPath, dataOutputPath, enableCache, cacheVersion, appCode)
  const loaderOutputPath = path.resolve(process.cwd(), path.dirname(metaOutputPath), 'index.ts')

  await fs.writeFile(loaderOutputPath, loaderCode, 'utf8')
  console.log(`[icon analysis] 已生成带缓存的Iconify加载器: ${loaderOutputPath}`)
}

/**
 * 生成加载器代码
 *
 * @param metaOutputPath 元数据文件路径
 * @param dataOutputPath 数据文件路径
 * @param enableCache 是否启用缓存
 * @param cacheVersion 缓存版本号
 * @param appCode 应用编码
 * @returns 生成的TypeScript代码
 */
function generateLoaderCode(
  metaOutputPath: string,
  dataOutputPath: string,
  enableCache: boolean,
  cacheVersion: string,
  appCode: string,
): string
{
  const cachePrefix = 'iconify_cache_'
  const cacheKeyPrefix = `${cachePrefix}${appCode}_`

  let loaderCode = `import { addCollection } from '@iconify/vue';
import iconsMeta from './${path.basename(metaOutputPath)}';
import data from './${path.basename(dataOutputPath)}';

// 缓存版本号 - 当图标发生变更时更新此版本号
const CACHE_VERSION = '${cacheVersion}';
// 应用编码 - 用于区分不同应用的图标缓存
const APP_CODE = '${appCode}';
const ICONIFY_CACHE_PREFIX = '${cachePrefix}';
const CACHE_KEY_PREFIX = '${cacheKeyPrefix}';

`

  if (enableCache)
  {
    loaderCode += generateCacheFunctions(cacheVersion, cacheKeyPrefix)
  }

  loaderCode += generateSetupFunction(enableCache)

  return loaderCode
}

/**
 * 生成缓存相关函数代码
 *
 * @param cacheVersion 缓存版本号
 * @param cacheKeyPrefix 缓存键前缀
 * @returns 缓存函数代码
 */
function generateCacheFunctions(cacheVersion: string, cacheKeyPrefix: string): string
{
  return `/**
 * 获取缓存键名
 * @param iconSetName 图标集名称
 * @param iconSetHash 图标集文件hash值
 * @returns 缓存键名
 */
function getCacheKey(iconSetName: string, iconSetHash: string): string {
  return \`\${CACHE_KEY_PREFIX}\${iconSetName}_v${cacheVersion}_h\${iconSetHash}\`;
}

/**
 * 从缓存中获取图标数据
 * @param iconSetName 图标集名称
 * @param iconSetHash 图标集文件hash值
 * @returns 缓存的图标数据或null
 */
function getIconDataFromCache(iconSetName: string, iconSetHash: string): any | null {
  try {
    const cacheKey = getCacheKey(iconSetName, iconSetHash);
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (error) {
    console.warn(\`[iconify cache] 读取图标集 \${iconSetName} 缓存失败:\`, error);
  }
  return null;
}

/**
 * 清理其他应用的旧缓存以释放存储空间
 */
function cleanOtherAppsCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ICONIFY_CACHE_PREFIX) && !key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(\`[iconify cache] 清理其他应用缓存: \${key}\`);
    });
    if (keysToRemove.length > 0) {
      console.log(\`[iconify cache] 已清理其他应用的 \${keysToRemove.length} 个缓存项\`);
    }
  } catch (error) {
    console.warn('[iconify cache] 清理其他应用缓存失败:', error);
  }
}

/**
 * 将图标数据保存到缓存
 * @param iconSetName 图标集名称
 * @param iconData 图标数据
 * @param iconSetHash 图标集文件hash值
 */
function saveIconDataToCache(iconSetName: string, iconData: any, iconSetHash: string): void {
  try {
    const cacheKey = getCacheKey(iconSetName, iconSetHash);
    localStorage.setItem(cacheKey, JSON.stringify(iconData));
    console.log(\`[iconify cache] 图标集 \${iconSetName} 已缓存 (hash: \${iconSetHash})\`);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn(\`[iconify cache] 存储空间不足，尝试清理其他应用的旧缓存\`);
      cleanOtherAppsCache();
    } else {
      console.warn(\`[iconify cache] 保存图标集 \${iconSetName} 缓存失败:\`, error);
    }
  }
}

/**
 * 清理当前应用的旧版本和旧hash的缓存
 * @param currentHashes 当前有效的图标集hash值集合
 */
function cleanOldCache(currentHashes: string[] = []): void {
  try {
    const keysToRemove: string[] = [];
    const currentHashSet = new Set(currentHashes);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        const isCurrentVersion = key.includes(\`_v${cacheVersion}_h\`);
        if (isCurrentVersion) {
          const hashMatch = key.match(/_h([a-f0-9]{8})$/);
          if (hashMatch && currentHashes.length > 0 && !currentHashSet.has(hashMatch[1])) {
            keysToRemove.push(key);
          }
        } else {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(\`[iconify cache] 清理旧缓存: \${key}\`);
    });
    if (keysToRemove.length > 0) {
      console.log(\`[iconify cache] 清理了当前应用 \${keysToRemove.length} 个旧缓存项\`);
    }
  } catch (error) {
    console.warn('[iconify cache] 清理旧缓存失败:', error);
  }
}
`
}

/**
 * 生成setup函数代码
 *
 * @param enableCache 是否启用缓存
 * @returns setup函数代码
 */
function generateSetupFunction(enableCache: boolean): string
{
  return `/**
 * 下载并安装图标集
 * 从本地的JSON文件中加载图标数据并注册到Iconify组件库中${enableCache ? '\n * 支持localStorage缓存以提高性能' : ''}
 */
export async function setupIconify(): Promise<boolean> {
  // 开发环境跳过加载
  if (import.meta.env.DEV) return true;

  console.log('[iconify] 开始加载图标集...');

  ${enableCache ? '// 清理旧版本和旧hash缓存\n  const currentHashes = data.map(collection => collection.hash);\n  cleanOldCache(currentHashes);' : ''}

  let successCount = 0;
  const publicPath = import.meta.env.VITE_PUBLIC_PATH === '/' ? '' : (import.meta.env.VITE_PUBLIC_PATH || '');

  for (const collection of data) {
    const name = collection.prefix;
    const iconSetHash = collection.hash;

    try {
      ${enableCache
        ? `
      // 先尝试从缓存获取
      let iconData = getIconDataFromCache(name, iconSetHash);
      if (iconData) {
        console.log(\`[iconify] 从缓存加载图标集: \${name} (hash: \${iconSetHash})\`);
      } else {
        console.log(\`[iconify] 从网络加载图标集: \${name} (hash: \${iconSetHash})\`);
        const response = await fetch(\`\${publicPath}/icons/\${name}-raw.json?v=\${iconSetHash}\`, {
          cache: 'no-cache'
        });
        if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        iconData = await response.json();
        saveIconDataToCache(name, iconData, iconSetHash);
      }`
        : `
      // 直接从网络加载
      console.log(\`[iconify] 从网络加载图标集: \${name} (hash: \${iconSetHash})\`);
      const response = await fetch(\`\${publicPath}/icons/\${name}-raw.json?v=\${iconSetHash}\`, {
        cache: 'no-cache'
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      const iconData = await response.json();`}

      // 使用Object.freeze防止数据被修改，提高性能
      const frozenIconData = Object.freeze(iconData);
      const result = addCollection(frozenIconData);
      
      if (result) {
        successCount++;
        console.log(\`[iconify] 图标集 \${name} 安装成功\`);
      } else {
        console.warn(\`[iconify] 图标集 \${name} 安装失败\`);
      }
    } catch (error) {
      console.error(\`[iconify] 图标集 \${name} 加载失败:\`, error);
    }
  }

  console.log(\`[iconify] 图标加载完成: \${successCount}/\${data.length} 个图标集加载成功\`);
  return successCount > 0;
}

/**
 * 图标数据，可作为页面组件的数据源（选择图标功能）
 */
export const icons = data.sort((a, b) => a.info.name.localeCompare(b.info.name));
`
}
