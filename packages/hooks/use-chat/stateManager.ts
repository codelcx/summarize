import { computed, ComputedRef, ref, Ref } from 'vue'
import { ChatState, MessageItem } from './types'

/**
 * 创建状态管理器
 */
export function createStateManager()
{
  // 是否正在生成消息的状态
  const isMessaging = ref(false)
  // 是否已接收到消息的状态（用于控制停止按钮的启用）
  const hasReceived = ref(false)
  // 当前活动的控制器，用于中断请求
  const activeController = ref<AbortController | null>(null)
  // 当前消息项
  const currentMessageItem = ref<MessageItem | null>(null)
  // 当前消息中断的resolve函数
  let abortResolve: (() => void) | undefined

  // 是否正在生成活跃状态（正在生成消息或语音）
  const isActive = computed(() => activeController.value !== null)

  function setMessaging(value: boolean): void
  {
    isMessaging.value = value
  }

  function setHasReceived(value: boolean): void
  {
    hasReceived.value = value
  }

  function setActiveController(controller: AbortController | null): void
  {
    activeController.value = controller
  }

  function setCurrentMessageItem(item: MessageItem | null): void
  {
    currentMessageItem.value = item
  }

  function setAbortResolve(resolve: (() => void) | undefined): void
  {
    abortResolve = resolve
  }

  function getAbortResolve(): (() => void) | undefined
  {
    return abortResolve
  }

  function clearState(): void
  {
    isMessaging.value = false
    hasReceived.value = false
    activeController.value = null
  }

  function reset(): void
  {
    clearState()
    abortResolve = undefined
    currentMessageItem.value = null
  }

  return {
    // 响应式状态
    isMessaging,
    hasReceived,
    activeController,
    currentMessageItem,
    isActive,

    // 操作方法
    setMessaging,
    setHasReceived,
    setActiveController,
    setCurrentMessageItem,
    setAbortResolve,
    getAbortResolve,
    clearState,
    reset,
  }
}
