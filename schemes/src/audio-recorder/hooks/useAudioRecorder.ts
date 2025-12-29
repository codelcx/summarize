import { onUnmounted, ref } from 'vue'
import AudioRecorder from './AudioRecorder'

export enum RecorderMode {
  /** 已准备 */
  READY,
  /** 开始倒计时 */
  COUNTDOWN,
  /** 录音中 */
  RECORDING,
  /** 已完成 */
  COMPLETE,
}

export interface RecorderOptions {
  /** 最长录制时长（秒） */
  maxDuration?: number
  /** 静默时长(秒), 默认0秒 */
  silenceDuration?: number
}

export function useAudioRecorder()
{
  let recorder: AudioRecorder | null = null // 录音管理器
  let startCountDownTimer: any = null // 开始录音倒计时定时器
  let endCountDownTimer: any = null // 结束录音倒计时定时器

  const hasPermission = ref(false) // 录音权限
  const recordMode = ref<RecorderMode>(RecorderMode.READY) // 录音状态
  const duration = ref(0) // 录音时长
  const buffer = ref<Uint8Array | undefined>(undefined) // 用于存储实时波形数据
  const arrayBuffer = ref<ArrayBuffer | undefined>(undefined) // 录音结束后的音频数据
  const startCountdown = ref(0) // 开始录音倒计时
  const endCountDown = ref(0) // 结束录音倒计时

  const config: RecorderOptions = {}

  /**
   * 销毁资源
   */
  onUnmounted(() =>
  {
    if (recorder)
    {
      recorder.stop()
      recorder = null
    }

    if (startCountDownTimer)
    {
      clearTimeout(startCountDownTimer)
    }

    if (endCountDownTimer)
    {
      clearTimeout(endCountDownTimer)
    }

    console.warn('【Recorder】录音相关资源已销毁')
  })

  /**
   * 初始化录音状态
   */
  function initRecordStatus()
  {
    duration.value = 0
    startCountdown.value = 0
    endCountDown.value = 0
    buffer.value = undefined
    arrayBuffer.value = undefined
    recordMode.value = RecorderMode.READY
  }

  /**
   * 实例化录音管理器
   */
  function initRecorder(options: Partial<RecorderOptions> = {})
  {
    initRecordStatus()
    Object.assign(config, options)

    if (recorder)
    {
      return recorder
    }

    recorder = new AudioRecorder()

    // 录音权限回调
    recorder.onPermission = (permission) =>
    {
      if (permission)
      {
        hasPermission.value = true
        return
      }

      initRecordStatus()
    }

    // 录音开始回调
    recorder.onStart = () =>
    {
      recorderLimitTimer()
    }

    // 录音结束回调
    recorder.onStop = (buffer) =>
    {
      if (buffer instanceof ArrayBuffer)
      {
        arrayBuffer.value = buffer
      }

      recordMode.value = RecorderMode.COMPLETE

      if (endCountDownTimer)
      {
        clearTimeout(endCountDownTimer)
      }
    }

    // 录音帧数据回调
    recorder.onFrame = (rawBuffer: Uint8Array) =>
    {
      buffer.value = rawBuffer
    }

    return recorder
  }

  /**
   * 限制录音时长定时器
   */
  async function recorderLimitTimer(duration?: number)
  {
    endCountDown.value = duration || config.maxDuration || 0

    if (endCountDown.value <= 0)
    {
      return
    }

    if (endCountDownTimer)
    {
      clearInterval(endCountDownTimer)
    }

    endCountDownTimer = setInterval(
      () =>
      {
        endCountDown.value--
        if (endCountDown.value === 0)
        {
          clearInterval(endCountDownTimer)
          endCountDownTimer = null
        }
      },
      1000,
    )
  }

  /**
   * 倒计时录音定时器
   */
  async function recorderSilenceTimer(duration?: number)
  {
    startCountdown.value = duration || config.silenceDuration || 0

    if (startCountdown.value <= 0)
    {
      return
    }

    if (startCountDownTimer)
    {
      clearInterval(startCountDownTimer)
    }

    return new Promise<void>((resolve) =>
    {
      recordMode.value = RecorderMode.COUNTDOWN
      startCountDownTimer = setInterval(
        () =>
        {
          startCountdown.value--
          // 提前1秒启动录音，因为内部处理需要一定时间
          // 防止倒计时结束时还未能录音
          if (startCountdown.value === 1)
          {
            resolve()
          }
          if (startCountdown.value <= 0)
          {
            recordMode.value = RecorderMode.RECORDING
            clearInterval(startCountDownTimer)
            startCountDownTimer = null
          }
        },
        1000,
      )
    })
  }

  /**
   * 开始录音
   */
  async function startRecord()
  {
    if (!recorder)
    {
      console.error('【Recorder】录音管理器未初始化')
      return
    }

    if (recordMode.value === RecorderMode.COUNTDOWN)
    {
      console.warn('【Recorder】正在倒计时')
      return
    }

    if (recordMode.value === RecorderMode.RECORDING)
    {
      console.warn('【Recorder】正在录音中')
      return
    }

    if (!hasPermission.value)
    {
      const permission = await recorder.checkPermission()
      if (!permission)
      {
        console.warn('【Recorder】未授权录音权限')
        return false
      }
    }

    initRecordStatus()
    await recorderSilenceTimer()

    recorder?.start()
  }

  /**
   * 暂停录音
   */
  function pauseRecord()
  {
    recorder?.pause()
    if (endCountDownTimer)
    {
      clearTimeout(endCountDownTimer)
    }
  }

  /**
   * 恢复录音
   */
  function resumeRecord()
  {
    recorder?.resume()
    recorderLimitTimer(endCountDown.value)
  }

  /**
   * 停止录音
   */
  async function stopRecord()
  {
    await recorder?.stop()
  }

  return {
    buffer,
    arrayBuffer,
    duration,
    recordMode,
    startCountdown,
    endCountDown,
    initRecorder,
    startRecord,
    stopRecord,
    pauseRecord,
    resumeRecord,
  }
}
