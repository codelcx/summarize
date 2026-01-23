import fs from 'node:fs'
import path from 'node:path'
import { option } from '../option'
import { jsonFormatter } from './json'

/**
 * @description: 新建国际化配置文件夹
 * @return {*}
 */
export function initLangFile()
{
  if (!fs.existsSync(option.globalPath!))
  {
    fs.mkdirSync(option.globalPath!) // 创建lang文件夹
  }
  initLangTranslateJSONFile()
}

/**
 * @description: 生成国际化JSON文件
 * @return {*}
 */
export function initLangTranslateJSONFile()
{
  const indexPath = path.join(option.globalPath!, 'index.json')
  if (!fs.existsSync(indexPath))
  {
    // 不存在就创建
    fs.writeFileSync(indexPath, JSON.stringify({}))
  }
}

/**
 * @description: 读取国际化JSON文件
 * @return {*}
 */
export function getLangTranslateJSONFile()
{
  const filePath = path.join(option.globalPath!, 'index.json')
  try
  {
    const content = fs.readFileSync(filePath, 'utf8')
    return content
  }
  catch (error: any)
  {
    if (error.code === 'ENOENT')
    {
      console.log('❌读取JSON配置文件异常，文件不存在')
    }
    else
    {
      console.log('❌读取JSON配置文件异常，无法读取文件')
    }
    return JSON.stringify({})
  }
}

/**
 * @description: 基于langKey获取JSON配置文件中对应语言对象
 * @param {string} key
 * @return {*}
 */
export function getLangObjByJSONFileWithLangKey(key: string, insertJSONObj?: object | undefined)
{
  const JSONObj = insertJSONObj || JSON.parse(getLangTranslateJSONFile())
  const langObj: any = {}
  Object.keys(JSONObj).forEach((value) =>
  {
    langObj[value] = JSONObj[value][key]
  })
  return langObj
}

/**
 * @description: 设置国际化JSON文件
 * @return {*}
 */
export function setLangTranslateJSONFile(obj: object)
{
  const filePath = path.join(option.globalPath!, 'index.json')
  const jsonObj = jsonFormatter(obj)
  if (fs.existsSync(filePath))
  {
    fs.writeFileSync(filePath, jsonObj)
  }
  else
  {
    console.log('❌JSON配置文件写入异常，文件不存在')
  }
}

/**
 * @description: 构建时把lang配置文件设置到打包后到主文件中
 * @return {*}
 */
export function buildSetLangConfigToIndexFile()
{
  if (!option.buildToDist) return
  const langObjMap: any = {}
  option.langKey!.forEach((item) =>
  {
    langObjMap[item] = getLangObjByJSONFileWithLangKey(item)
  })
  if (fs.existsSync(option.distPath!))
  {
    fs.readdir(option.distPath!, (err, files) =>
    {
      if (err)
      {
        console.error('❌构建文件夹为空，翻译配置无法写入')
        return
      }

      files.forEach((file) =>
      {
        if (file.startsWith(option.distKey!) && file.endsWith('.js'))
        {
          const filePath = path.join(option.distPath!, file)
          fs.readFile(filePath, 'utf8', (err, data) =>
          {
            if (err)
            {
              console.log(filePath)
              console.error('❌构建主文件不存在，翻译配置无法写入')
              return
            }
            let buildLangConfigString = ''
            Object.keys(langObjMap).forEach((item) =>
            {
              buildLangConfigString = `${buildLangConfigString}globalThis['${option.namespace}']['${item}']=${JSON.stringify(langObjMap[item])};`
            })
            try
            {
              // 翻译配置写入主文件
              fs.writeFileSync(filePath, `globalThis['${option.namespace}']={};${buildLangConfigString}${data}`)
              console.info('恭喜：翻译配置写入构建主文件成功🌟🌟🌟')
            }
            catch (error)
            {
              console.error('翻译配置写入构建主文件失败:', error)
            }
          })
        }
      })
    })
  }
}
