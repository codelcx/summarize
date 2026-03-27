import { unref } from 'vue'
import { createStateManager } from './stateManager'
import { createMessageUpdater } from './messageUpdater'
import { createSSEMessageHandler } from './sseMessageHandler'
import { createConnectionManager } from './connectionManager'
import { ChatConfig, SendMessageOption, UseChatReturn } from './types'

/**
 * 创建AI聊天钩子函数
 * @param config 聊天配置
 * @returns 聊天钩子函数API
 */
export function createChatHook(config: ChatConfig)
{
  /**
   * AI聊天钩子函数
   * 提供消息发送、接收和状态管理功能
   */
  return function useChat(): UseChatReturn
  {
    // 状态管理
    const state = createStateManager()

    // 消息更新器
    const messageUpdater = createMessageUpdater(state.currentMessageItem, config)

    // SSE消息处理器回调
    const sseCallbacks = {
      onMessage: (messageItem: any, type: any) =>
      {},
      onFinish: (messageItem: any, type: any) =>
      {},
      onError: (error: Error) =>
      {
        console.log(error)
      },
      setMessagingState: (value: boolean) => state.setMessaging(value),
      setHasReceivedState: (value: boolean) => state.setHasReceived(value),
      clearActiveController: () => state.setActiveController(null),
    }

    // SSE消息处理器
    const sseHandler = createSSEMessageHandler(
      { value: state.currentMessageItem.value },
      messageUpdater.updateMessage,
      sseCallbacks,
    )

    // 连接管理器
    const connectionManager = createConnectionManager(config, {
      sseHandler,
      onError: (error, option) => handleError(error, option),
      onClose: () =>
      {
        if (state.activeController.value)
        {
          state.activeController.value.abort()
          state.setActiveController(null)
        }
      },
    })

    /**
     * 统一错误处理函数
     */
    function handleError(err: Error, option: SendMessageOption): void
    {
      console.error('AI聊天请求错误:', err, state.activeController.value)

      const errorMessage = err.message || config.errorText || '服务出错了'

      state.setMessaging(false)
      state.setHasReceived(false)
      state.setActiveController(null)

      messageUpdater.setMessageError(errorMessage, !!option.ttsVo)

      option.onError?.(err)
      option.onFinish?.(state.currentMessageItem.value)
    }

    /**
     * 中断当前正在进行的消息生成（异步）
     */
    function abortCurrentMessage(): Promise<void>
    {
      return new Promise((resolve) =>
      {
        // 如果当前有正在进行的请求，并且没有正在中断的请求，则中断请求
        if (state.activeController.value && !state.getAbortResolve())
        {
          state.setAbortResolve(resolve)
          console.warn('[ 异步中断消息 ]', state.getAbortResolve())
          state.activeController.value.abort()
          state.setActiveController(null)
        }
        // 如果当前已经有等待中断的请求，则不覆盖，直接跳过
        else if (state.getAbortResolve())
        {
          resolve()
        }
        else
        {
          state.setAbortResolve(undefined)
          resolve()
        }
      })
    }

    /**
     * 设置中断监听器
     */
    function setupAbortListener(controller: AbortController, option: SendMessageOption): void
    {
      const questionId = ''

      controller.signal.addEventListener('abort', () =>
      {
        // 如果是在消息生成过程中手动中断
        if (state.isMessaging.value)
        {
          option.onAbort?.(questionId)
        }

        // 重置状态
        state.clearState()

        console.warn('[abort]', questionId, state.currentMessageItem.value?.questionId)

        // 更新消息状态为已完成，并设置中断提示
        messageUpdater.setMessageAborted(!!option.ttsVo)

        // 如果有等待中的中断resolve函数，则执行它
        const abortResolve = state.getAbortResolve()
        if (abortResolve)
        {
          abortResolve()
          state.setAbortResolve(undefined)
        }
      })
    }

    /**
     * 发送消息函数
     */
    async function sendMessage(option: SendMessageOption)
    {
      // 如果有正在进行的请求，先中断
      await abortCurrentMessage()

      // 重置SSE处理器
      sseHandler.reset()

      // 创建初始消息项
      const initialMessage = messageUpdater.createInitialMessage(option.question, !!option.ttsVo)
      state.setCurrentMessageItem(initialMessage)

      // 更新回调引用
      sseCallbacks.onMessage = option.onMessage || (() =>
      {})
      sseCallbacks.onFinish = option.onFinish || (() =>
      {})
      sseCallbacks.onError = option.onError || (() =>
      {})

      // 调用开始回调
      option.onStart?.()

      // 创建AbortController用于中断请求
      const controller = new AbortController()
      state.setActiveController(controller)

      // 设置中断监听器
      setupAbortListener(controller, option)

      // 建立SSE连接
      connectionManager.connect(option, controller)

      return {
        messageItem: unref(state.currentMessageItem),
        abort: () => controller.abort(),
      }
    }

    // 返回钩子函数的公开API
    return {
      sendMessage,
      abortCurrentMessage,
      isMessaging: state.isMessaging,
      hasReceived: state.hasReceived,
      isActive: state.isActive,
      currentMessageItem: state.currentMessageItem,
    }
  }
}
