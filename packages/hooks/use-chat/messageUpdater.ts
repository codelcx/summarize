import { Ref } from 'vue'
import { MessageItem, VoiceData } from './types'

/**
 * 消息更新器类
 * 负责管理消息项的更新操作
 */
export function createMessageUpdater(
  currentMessageItem: Ref<MessageItem | null>,
  config: { loadingText?: string },
)
{
  /**
   * 创建初始消息项
   */
  function createInitialMessage(question: string, hasVoice: boolean): MessageItem
  {
    return {
      question,
      content: config.loadingText || '思考中...',
      reasoningContent: '',
      gptStatus: 'loading',
      voiceStatus: hasVoice ? 'loading' : undefined,
      originalData: [],
    }
  }

  /**
   * 更新消息列表中的最后一条消息（AI回复）
   * @param messageData 消息数据
   * @param originalData 原始消息体data数据
   */
  function updateMessage(messageData: Partial<MessageItem>, originalData?: any): void
  {
    const messageItem = currentMessageItem.value
    if (!messageItem) return

    // 过滤掉voiceList中questionId不匹配的音频数据
    // 由于中断上一次消息是异步的，若频繁中断可能会导致上一次消息的音频数据赋值到当前消息对象中
    if (messageData.voiceList && messageItem.questionId)
    {
      filterVoiceListByQuestionId(messageData.voiceList, messageItem.questionId)
    }

    // 保存原始数据
    if (originalData)
    {
      messageItem.originalData.push(originalData)
    }

    // 合并消息数据到当前消息项
    Object.assign(messageItem, messageData)
  }

  /**
   * 过滤语音列表，只保留匹配当前问题ID的语音数据
   */
  function filterVoiceListByQuestionId(voiceList: VoiceData[], questionId: string): void
  {
    for (let i = 0; i < voiceList.length; i++)
    {
      if (voiceList[i].questionId !== questionId)
      {
        voiceList.splice(i, 1)
        i--
      }
    }
  }

  /**
   * 设置消息为中断状态
   */
  function setMessageAborted(hasVoice: boolean): void
  {
    const currentItem = currentMessageItem.value
    updateMessage({
      gptStatus: 'complete',
      content: currentItem?.content === config.loadingText ? '消息已被中断' : currentItem?.content,
      voiceStatus: hasVoice ? 'complete' : undefined,
    })
  }

  /**
   * 设置消息为错误状态
   */
  function setMessageError(errorMessage: string, hasVoice: boolean): void
  {
    updateMessage({
      content: errorMessage,
      gptStatus: 'error',
      voiceStatus: hasVoice ? 'error' : undefined,
    })
  }

  return {
    createInitialMessage,
    updateMessage,
    setMessageAborted,
    setMessageError,
  }
}
