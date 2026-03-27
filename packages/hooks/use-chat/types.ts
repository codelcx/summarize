import { ComputedRef, Ref } from 'vue'

/**
 * 错误码枚举
 */
export enum ErrorCode {
  /** 未知对话ID */
  UNKNOWN_DIALOG_CODE = 10_010,
  /** GPT异常 */
  GPT_ERROR = 2900,
  /** GPT响应异常 */
  GPT_RESP_ERROR = 2901,
  /** GPT响应数据为空 */
  GPT_RESP_EMPTY = 2902,
  /** GPT数据解析失败 */
  GPT_PARSING_FAIL = 2903,
  /** 第三方服务异常 */
  GPT_THIRD_ERROR = 2999,
  /** 登录认证失败 */
  LOGIN_AUTH_FAILED = 401,
  /** HTTP错误 */
  HTTP_ERROR = 400,
}

/**
 * 音频格式枚举
 */
export enum AudioFormat {
  WAV = 'wav',
  MP3 = 'mp3',
}

/**
 * 音频来源标志枚举
 */
export enum AudioFromFlag {
  /** 思考过程 */
  THINK = 0,
  /** 答案内容 */
  CONTENT = 1,
}

/**
 * 语音数据接口
 */
export interface VoiceData {
  /** 音频URL */
  audioUrl?: string
  /** 混合形状（表情）URL */
  blendShapeUrl?: string
  /** 内容 */
  content?: string
  /** 是否完成 */
  done?: boolean
  /** 时长（秒） */
  duration?: number
  /** 音频来源标志 */
  flag?: AudioFromFlag
  /** 音频格式 */
  format?: AudioFormat
  /** 问题ID */
  questionId?: string
}

/**
 * 消息项接口
 */
export interface MessageItem {
  /** 回答内容 */
  content: string
  /** GPT状态：加载中、生成中、完成、错误 */
  gptStatus: 'loading' | 'generating' | 'complete' | 'error'
  /** 问候语语音列表 */
  greetingVoiceList?: VoiceData[]
  /** 消息ID */
  msgId?: string
  /** 原始数据数组 */
  originalData: any[]
  /** 建议问题列表 */
  problems?: string[]
  /** 问题内容 */
  question: string
  /** 问题ID（用于标识） */
  questionId?: string
  /** 思考过程内容 */
  reasoningContent?: string
  /** 语音列表 */
  voiceList?: VoiceData[]
  /** 语音状态 */
  voiceStatus?: 'loading' | 'generating' | 'complete' | 'error'
}

/**
 * 发送消息参数接口
 */
export interface SendMessageOption {
  /** 音频驱动版本 */
  audioDrivenVersion?: string
  /** 对话ID */
  dialogId?: string
  /** 域用户ID */
  domainUserId?: string
  /** GPT模型编码 */
  gptModelCode?: string
  /** 模型编码 */
  modelCode?: string
  /** 是否仅使用GPT（默认true） */
  onlyGpt?: boolean
  /** 用户问题 */
  question: string
  /** 是否开启字幕 */
  subtitle?: boolean
  /** TTS语音编码 */
  ttsVo?: string
  /** 中断回调 */
  onAbort?: (questionId?: string) => void
  /** 错误回调 */
  onError?: (error: Error) => void
  /** 完成回调 */
  onFinish?: (messageItem: MessageItem | null, type?: 'gpt' | 'voice') => void
  /** 消息接收回调（每次接收数据时触发） */
  onMessage?: (messageItem: MessageItem, type: 'greeting' | 'gpt' | 'voice') => void
  /** 开始回调 */
  onStart?: () => void
}

/**
 * 聊天配置接口
 */
export interface ChatConfig {
  /** API地址 */
  apiUrl: string
  /** 自定义请求头 */
  customHeaders?: Record<string, string>
  /** 错误文本（默认'服务出错了'） */
  errorText?: string
  /** 额外的请求体参数 */
  extraBody?: Record<string, any>
  /** 加载中文本（默认'思考中...'） */
  loadingText?: string
  /** 是否在页面隐藏时保持连接（默认true） */
  openWhenHidden?: boolean
  /** 获取Token的方法 */
  getToken: () => string
}

/**
 * SSE消息数据接口
 */
export interface SSEMessageData {
  data: any
  event: string
}

/**
 * 聊天状态接口
 */
export interface ChatState {
  abortResolve: (() => void) | undefined
  activeController: Ref<AbortController | null>
  currentMessageItem: Ref<MessageItem | null>
  hasReceived: Ref<boolean>
  isMessaging: Ref<boolean>
}

/**
 * 聊天钩子返回值接口
 */
export interface UseChatReturn {
  /** 当前消息项（响应式） */
  currentMessageItem: Ref<MessageItem | null>
  /** 是否已接收到消息（用于控制停止按钮） */
  hasReceived: Ref<boolean>
  /** 是否处于活跃状态（正在生成消息或语音） */
  isActive: ComputedRef<boolean>
  /** 是否正在生成消息（响应式） */
  isMessaging: Ref<boolean>
  /** 中断当前消息生成 */
  abortCurrentMessage: () => Promise<void>
  /** 发送消息 */
  sendMessage: (option: SendMessageOption) => Promise<{ messageItem: MessageItem | null, abort: () => void }>
}
