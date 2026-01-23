import { OriginLangKeyEnum } from '../enums'

export const REGEX_MAP = {
  [OriginLangKeyEnum.ZH]: /[\u4E00-\u9FFF]/,
  [OriginLangKeyEnum.EN]: /[a-z]/i,
  [OriginLangKeyEnum.JA]: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/, // 日语假名和汉字
  [OriginLangKeyEnum.KO]: /[\uAC00-\uD7A3]/, // 韩语字母
  [OriginLangKeyEnum.RU]: /[йцукенгшщзхъфывапролджэячсмитьбюё .-]+/, // 俄语字母
}
