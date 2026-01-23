import { option } from '../option'
import * as fileUtils from './file'
import { IWordItem } from '../types'
import { ETranslateType } from '../enums'

export const SEPARATOR = '\n┇┇┇\n'

/**
 * 翻译管理器类
 */
class TranslationManager
{
  private wordList: IWordItem[] = []
  private static instance: TranslationManager | null = null

  private constructor()
  {
    this.initWordList()
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TranslationManager
  {
    if (!TranslationManager.instance)
    {
      TranslationManager.instance = new TranslationManager()
    }
    return TranslationManager.instance
  }

  public initWordList(): void
  {
    this.wordList = []
  }

  /**
   * 获取词语列表
   */
  public getWordList()
  {
    return this.wordList
  }

  /**
   * 获取翻译对象数量
   */
  public getCount(): number
  {
    return this.wordList.length
  }

  /**
   * 清空翻译对象
   */
  public clear(): void
  {
    this.wordList = []
  }

  /**
   * 设置翻译对象属性
   * @param wordItem 词语项
   */
  public setWordItem(wordItem: IWordItem): void
  {
    const { code, type, path, label } = wordItem
    const hasWord = this.wordList.some(item => item.code === code)

    if (!option.unique || (option.unique && !hasWord))
    {
      const word = {
        code,
        type,
        category: '',
        path,
      } as IWordItem

      word[`label_${option.originLang}`] = label
      option.targetLangList?.forEach((lang: string) => word[`label_${lang}`] = '')
      console.log('insert word:', label)
      this.wordList.push(word)
    }
  }

  public autoTranslate()
  {
    // TODO: 自动翻译

    // 写入文件
    try
    {
      fileUtils.setLangTranslateJSONFile(this.wordList)
      console.info('🎉 多语言配置文件已成功更新')
    }
    catch (error)
    {
      console.error('❌ 配置文件写入失败，原因:', error)
      // todo 可添加重试逻辑或回滚机制
    }
  }
}

export const translationManager = TranslationManager.getInstance()
