import { fetchEventSource } from '@microsoft/fetch-event-source'
import { ChatConfig, SendMessageOption } from './types'

/**
 * 创建连接管理器
 */
export function createConnectionManager(
  config: ChatConfig,
  handlers: {
    sseHandler: ReturnType<typeof import('./sseMessageHandler').createSSEMessageHandler>
    onError: (error: Error, option: SendMessageOption) => void
    onClose: () => void
  },
)
{
  /**
   * 构建请求体
   */
  function buildRequestBody(option: SendMessageOption): Record<string, any>
  {
    return {
      question: option.question,
      dialogId: option.dialogId,
      modelCode: option.modelCode,
      onlyGpt: option.onlyGpt ?? true,
      subtitle: option.subtitle ?? false,
      gptModelCode: option.gptModelCode,
      ttsVo: option.ttsVo,
      domainUserId: option.domainUserId,
      audioDrivenVersion: option.audioDrivenVersion,
      ...config.extraBody,
    }
  }

  /**
   * 构建请求头
   */
  function buildHeaders(): Record<string, string>
  {
    return {
      'Content-Type': 'application/json',
      'x_auth_token': config.getToken(),
      ...config.customHeaders,
    }
  }

  /**
   * 处理HTTP响应状态
   */
  async function handleResponseStatus(response: Response, option: SendMessageOption): Promise<void>
  {
    if (response.status === 401)
    {
      const error = new Error('登录状态失效，请重新登录')
      error.cause = {
        code: 401,
        message: '登录认证失败',
      }
      handlers.onError(error, option)
    }
    else if (response.status >= 400)
    {
      const error = new Error(`HTTP错误: ${response.status}`)
      error.cause = {
        code: 400,
        message: response.statusText || 'HTTP请求失败',
      }
      handlers.onError(error, option)
    }
  }

  /**
   * 建立SSE连接
   */
  function connect(
    option: SendMessageOption,
    controller: AbortController,
    onOpen?: () => void,
    onClose?: () => void,
  ): void
  {
    const requestBody = buildRequestBody(option)
    const headers = buildHeaders()

    fetchEventSource(config.apiUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(requestBody),
      openWhenHidden: config.openWhenHidden ?? true,

      async onopen(response)
      {
        await handleResponseStatus(response, option)
        onOpen?.()
      },

      onmessage(ev)
      {
        handlers.sseHandler.handleMessage(ev)
      },

      onerror(err)
      {
        handlers.onError(err, option)
        throw new Error(`服务出错了${err.message}`)
      },

      onclose()
      {
        onClose?.()
        handlers.onClose()
      },
    })
  }

  return {
    connect,
  }
}
