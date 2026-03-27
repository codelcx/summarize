import { MessageItem, SendMessageOption, SSEMessageData } from './types'

/**
 * GPT消息累积器
 * 负责累积流式消息的内容
 */
export function createGptAccumulator()
{
  let content = ''
  let reasoningContent = ''
  let questionId = ''

  function reset(): void
  {
    content = ''
    reasoningContent = ''
    questionId = ''
  }

  function accumulateContent(text: string): void
  {
    content += text
  }

  function accumulateReasoning(text: string): void
  {
    reasoningContent += text
  }

  function setQuestionId(id: string): void
  {
    questionId = id
  }

  function getCurrent(): { content: string, reasoningContent: string, questionId: string }
  {
    return { content, reasoningContent, questionId }
  }

  return {
    reset,
    accumulateContent,
    accumulateReasoning,
    setQuestionId,
    getCurrent,
  }
}

/**
 * 创建SSE消息处理器
 */
export function createSSEMessageHandler(
  currentMessageItem: { value: MessageItem | null },
  updateMessage: (data: Partial<MessageItem>, originalData?: any) => void,
  callbacks: {
    onMessage?: SendMessageOption['onMessage']
    onFinish?: SendMessageOption['onFinish']
    onError?: SendMessageOption['onError']
    setMessagingState: (value: boolean) => void
    setHasReceivedState: (value: boolean) => void
    clearActiveController: () => void
  },
)
{
  const gptAccumulator = createGptAccumulator()

  /**
   * 处理问候语消息
   */
  function handleGreeting(data: any): void
  {
    const resData = data.data
    const currentItem = currentMessageItem.value

    if (resData.questionId === currentItem?.questionId)
    {
      if (!currentItem?.greetingVoiceList && currentItem) currentItem.greetingVoiceList = []

      const greetingVoiceList = currentItem?.greetingVoiceList
      if (resData.audioUrl && resData.blendShapeUrl && greetingVoiceList)
      {
        greetingVoiceList.push({ ...resData })
      }

      updateMessage({ greetingVoiceList }, resData)
      callbacks.onMessage?.(currentMessageItem.value!, 'greeting')
    }
  }

  /**
   * 处理GPT消息
   */
  function handleGpt(data: any): void
  {
    const resData = data.data

    if (resData.done)
    {
      // 消息完成
      if (resData.content)
      {
        gptAccumulator.accumulateContent(resData.content)
      }

      const { content, questionId } = gptAccumulator.getCurrent()
      callbacks.setMessagingState(false)
      callbacks.setHasReceivedState(false)

      const problems = resData.problems || []
      updateMessage(
        {
          msgId: resData.msgId,
          content,
          problems,
          gptStatus: 'complete',
        },
        resData,
      )

      callbacks.onFinish?.(currentMessageItem.value!, 'gpt')
    }
    else
    {
      // 消息未完成，累积内容
      if (resData.content)
      {
        gptAccumulator.accumulateContent(resData.content)
      }
      if (resData.reasoningContent)
      {
        gptAccumulator.accumulateReasoning(resData.reasoningContent)
      }
      if (resData.questionId)
      {
        gptAccumulator.setQuestionId(resData.questionId)
      }

      const { content, reasoningContent, questionId } = gptAccumulator.getCurrent()
      callbacks.setHasReceivedState(true)

      updateMessage(
        {
          msgId: resData.msgId,
          content,
          reasoningContent,
          questionId,
          gptStatus: 'generating',
        },
        resData,
      )

      callbacks.onMessage?.(currentMessageItem.value!, 'gpt')
    }
  }

  /**
   * 处理音频消息（BS）
   */
  function handleBs(data: any): void
  {
    const resData = data.data
    const currentItem = currentMessageItem.value

    if (resData.questionId === currentItem?.questionId)
    {
      if (!currentItem?.voiceList && currentItem) currentItem.voiceList = []

      const voiceList = currentItem?.voiceList
      if (resData.audioUrl && resData.blendShapeUrl && voiceList)
      {
        voiceList.push({ ...resData })
      }

      updateMessage(
        {
          voiceList,
          voiceStatus: resData.done ? 'complete' : 'generating',
        },
        resData,
      )

      if (resData.done)
      {
        callbacks.clearActiveController()
        callbacks.onFinish?.(currentMessageItem.value!, 'voice')
      }
      else
      {
        callbacks.onMessage?.(currentMessageItem.value!, 'voice')
      }
    }
    else
    {
      console.warn(
        'BS 消息ID不匹配',
        resData.questionId,
        currentItem?.questionId,
        resData.content,
      )
    }
  }

  /**
   * 处理错误事件
   */
  function handleErrorEvent(data: any): boolean
  {
    if (data.code !== 0 && data.message)
    {
      const error = new Error(data.message)
      error.cause = {
        code: data.code,
        message: data.message,
      }
      callbacks.onError?.(error)
      return true
    }
    return false
  }

  /**
   * 处理SSE消息
   */
  function handleMessage(ev: { event: string, data: string }): void
  {
    try
    {
      const res = JSON.parse(ev.data)

      if (ev.event === 'ERROR' && handleErrorEvent(res))
      {
        return
      }

      switch (ev.event)
      {
        case 'GREETING': {
          handleGreeting(res)

          break
        }
        case 'GPT': {
          handleGpt(res)

          break
        }
        case 'BS': {
          handleBs(res)

          break
        }
        default: {
          updateMessage({}, res.data)
        }
      }
    }
    catch
    {
      callbacks.onError?.(new Error('解析响应数据失败'))
    }
  }

  function reset(): void
  {
    gptAccumulator.reset()
  }

  return {
    handleMessage,
    reset,
  }
}
