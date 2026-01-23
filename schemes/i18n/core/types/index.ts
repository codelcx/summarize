import { ETranslateType } from '../enums'

/**
 * 语音标签
 * @example label_zh label_en
 */
type ILanguageTag = `label_${string}`

/**
 * 词条
 */
export interface IWordItem {
  category?: string
  code: string
  label: string
  path: string
  type?: ETranslateType
  [key: ILanguageTag]: string | undefined
}
