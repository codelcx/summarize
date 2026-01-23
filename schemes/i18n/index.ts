import path from 'node:path'
import * as babel from '@babel/core'
import { Plugin, ResolvedConfig } from 'vite'
import { baseUtils, fileUtils, filter, I18NConfig, initOption, option, translateUtils } from './core'

export * from './core'

const allowedExtensions = ['.vue', '.ts', '.js', '.tsx', '.jsx']

export default function vite(optionInfo?: I18NConfig)
{
  const name = 'vite-i18n-scanner-plugin'
  let config: ResolvedConfig

  initOption(optionInfo)

  fileUtils.initLangFile()
  console.log('初始化语言文件', translateUtils.translationManager)
  translateUtils.translationManager.initWordList()

  const plugin: Plugin = {
    name,
    configResolved(resolvedConfig: any)
    {
      // 存储最终解析的配置
      config = resolvedConfig
    },
    async transform(code: string, id: string)
    {
      // todo 没有目标语言直接返回
      if ([...allowedExtensions, ...(option.insertFileExtensions || [])].some(ext => id.endsWith(ext)))
      {
        console.log(`扫描文件: ${id}`)
        if (option.includePath!.length > 0 && !baseUtils.checkAgainstRegexArray(id, option.includePath!)) return code
        if (option.excludedPath!.length > 0 && baseUtils.checkAgainstRegexArray(id, option.excludedPath!)) return code

        // 清理查询参数
        const filePath = id.split('?')[0]

        // 获取项目根路径
        const rootPath = process.cwd()

        // 跨平台路径处理
        const normalizedRoot = path.normalize(rootPath)
        // 计算相对路径
        const relativePath = path.relative(normalizedRoot, filePath)
        // 转换路径分隔符为统一的 POSIX 风格
        const displayPath = relativePath.split(path.sep).join('/')

        const sourceObj = option.translateExtends
          ? (await option.translateExtends?.handleInitFile(code, id))
          : {
              source: code,
            }

        return babel
          .transformAsync(sourceObj.source, {
            configFile: false,
            plugins: [filter.default()],
            filenameRelative: displayPath,
          })
          .then((result) =>
          {
            if (config?.command === 'serve')
            {
              console.info('开发阶段批量翻译')
              translateUtils.translationManager.autoTranslate() // 执行前需要确保transformAsync已经完成
            }
            return result?.code
          })
          .catch((error) =>
          {
            console.error(error)
          })
      }
    },
    async buildEnd()
    {
      console.info('构建阶段批量翻译')
      await translateUtils.translationManager.autoTranslate()
    },
    async closeBundle()
    {
      // 翻译配置写入主文件
      await fileUtils.buildSetLangConfigToIndexFile()
      console.info('翻译完成✔')
    },
  }

  return plugin
}
