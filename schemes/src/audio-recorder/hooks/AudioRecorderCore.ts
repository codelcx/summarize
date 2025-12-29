/**
 * 基于库（recorder-core）实现的音频录制
 * 主要应用环境：H5、微信小程序
 * https://github.com/xiangyuecn/Recorder
 */

// 首先导入基础库
import Recorder from 'recorder-core'
// 再导入App支持
import RecorderApp from 'recorder-core/src/app-support/app'
// 最后导入编码器和其他支持
import 'recorder-core/src/engine/mp3'
import 'recorder-core/src/engine/mp3-engine'
import 'recorder-core/src/engine/pcm'

// 导入波形绘制扩展
import 'recorder-core/src/extensions/waveview'
import 'recorder-core/src/extensions/lib.fft'
import 'recorder-core/src/extensions/wavesurfer.view'
import 'recorder-core/src/extensions/frequency.histogram.view'

/** 需要编译成微信小程序时，引入微信小程序支持文件 */
// #ifdef MP-WEIXIN
// import 'recorder-core/src/app-support/app-miniProgram-wx-support.js';
// #endif

/** 实例化配置 */
export interface IAudioRecorderCoreOptions {
  arrayBufferType?: 'int16' | 'float32' // 音频数据类型，默认使用16位整数格式
  frameSize?: number // 音频帧大小，默认1280，对应16kHz时80ms的数据，帧大小= 采样率 * 帧时长（毫秒）
  sampleRate?: number // 采样率，默认16kHz，适合语音识别
}

/** 波形绘制配置 */
export interface IWaveConfig {
  container: any // 波形绘制容器
  effectConfig?: any // 波形效果配置
  effectType?: 'waveView' | 'waveSufferView' | 'frequencyHistogramView' // 波形效果类型，默认为频率图
  height?: number // 波形绘制高度
  width?: number // 波形绘制宽度
}

export default class AudioRecorderCore
{
  /** 存储录制的音频数据缓冲区（多个音频数据块） */
  private audioBuffers: ArrayBuffer[] = []
  /** 录音状态标志 */
  private isRecording = false
  /** 录音配置参数 */
  private config: IAudioRecorderCoreOptions = {
    sampleRate: 16_000,
    frameSize: 1280,
    arrayBufferType: 'int16',
  }

  /** 波形绘制器 */
  private waveVisualizer: any

  /**
   * 录音权限回调
   */
  public onPermission?: (isGranted: boolean) => void
  /**
   * 录音开始回调
   */
  public onStart?: () => void
  /**
   * 录音结束回调
   * @param arrayBuffer 已合并所有音频数据 或 多个音频数据块（若录制过程中有错误发生）
   */
  public onStop?: (arrayBuffer: ArrayBuffer | ArrayBuffer[]) => void
  /**
   * 帧录制回调
   * @param frameInfo 帧信息
   * @param rawInfo 原始信息
   */
  public onFrameRecorded?: (
    FrameInfo: {
      isLastFrame: boolean
      frameBuffer: ArrayBuffer
    },
    rawInfo?: {
      buffers: any
      powerLevel: number
      duration: number
      sampleRate: number
      bufferFirstIdx: number
      asyncEnd: () => void
    }) => void

  /**
   * 构造函数
   */
  constructor()
  {
    // 确保全局对象可用
    if (!Recorder || !RecorderApp)
    {
      console.error('[Recorder or RecorderApp] not loaded correctly, please check the import order of dependencies')
    }
  }

  /**
   * 获取当前录音实例
   */
  private getCurrentRecorder(): any
  {
    return RecorderApp.GetCurrentRecOrNull()
  }

  /**
   * 格式化流类型
   */
  private formatBufferType(buffers: any): ArrayBuffer
  {
    // PCM 数据已经是 Int16 格式，直接使用
    if (this.config.arrayBufferType === 'int16')
    {
      return new Int16Array(buffers).buffer
    }

    // 转换为 Float32 格式
    const float32Data = new Float32Array(buffers.length)
    for (const [i, buffer] of buffers.entries())
    {
      float32Data[i] = buffer / 0x80_00 // 将 Int16 转换为 -1.0 到 1.0 的 Float32
    }

    return float32Data.buffer
  }

  /**
   * 获取录音权限
   */
  public async getPermission()
  {
    return new Promise<boolean>((resolve) =>
    {
      RecorderApp.RequestPermission(
        () =>
        {
          this.onPermission?.(true)
          resolve(true)
        },
        (err: Error, isUserNotAllow: boolean) =>
        {
          this.onPermission?.(false)
          console.error(`[RecorderApp] Failed to request recording permission: ${err.message}`, isUserNotAllow ? 'User denied permission' : '')
          resolve(false)
        })
    })
  }

  /**
   * 开始录音
   *
   */
  public async start(options?: IAudioRecorderCoreOptions): Promise<void>
  {
    if (this.isRecording)
    {
      return
    }

    // 初始化配置
    this.audioBuffers = []
    const { sampleRate, frameSize, arrayBufferType } = options || {}
    this.config = { ...this.config, sampleRate, frameSize, arrayBufferType }

    try
    {
      if (!RecorderApp)
      {
        throw new Error('[RecorderApp] not loaded correctly')
      }

      // 设置全局缓冲区大小，这是静态属性而不是初始化参数
      Recorder.BufferSize = this.config.frameSize

      // (生产环境）设置全局的日志输出函数，可赋值一个空函数来屏蔽Recorder的日志输出
      Recorder.CLog = () =>
      {}

      // 使用 RecorderApp 统一接口，会自动选择使用原生录音或H5录音
      const success = await this.getPermission()

      if (!success)
      {
        throw new Error('Failed to get recording permission')
      }

      // 创建录音实例 - RecorderApp.Start 不会返回录音实例，只会通过回调通知成功或失败
      RecorderApp.Start(
        {
          type: 'mp3',
          sampleRate: this.config.sampleRate,
          bitRate: 16,
          // audioTrackSet: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          onProcess: (buffers: any, powerLevel: number, duration: number, sampleRate: number, bufferFirstIdx: number, asyncEnd: () => void) =>
          {
            // 只处理新的音频数据
            if (!buffers || buffers.length <= bufferFirstIdx)
            {
              return
            }

            // 获取最新的音频数据(取最后一个buffer)
            const newBuffer = buffers.at(-1)
            if (!newBuffer || newBuffer.length === 0)
            {
              return
            }

            // 转换为合适的格式
            const frameBuffer = this.formatBufferType(newBuffer)

            // 保存数据
            this.audioBuffers.push(frameBuffer)

            // 触发帧录制回调
            if (this.onFrameRecorded)
            {
              this.onFrameRecorded(
                {
                  frameBuffer,
                  isLastFrame: false,
                },
                {
                  buffers,
                  powerLevel,
                  duration,
                  sampleRate,
                  bufferFirstIdx,
                  asyncEnd,
                },
              )
            }
          },
        },
        () =>
        {
          this.isRecording = true
          console.warn('[RecorderApp] Recording started')
          this.onStart?.()
        },
        (err: any) =>
        {
          throw err
        })
    }
    catch (error)
    {
      console.error('[RecorderApp] Failed to start recording: ')
      this.stop()
      throw error
    }
  }

  /**
   * 停止录音
   */
  public stop(): Promise<boolean>
  {
    return new Promise((resolve) =>
    {
      if (!this.isRecording)
      {
        return
      }

      this.isRecording = false

      // 获取当前录音实例
      const currentRecorder = this.getCurrentRecorder()

      if (currentRecorder)
      {
        /**
         * RecorderApp.Stop 会自动关闭录音实例，不需要手动关闭
         * arrayBuffer 为整个录音的音频数据
         * duration 录音时长
         * mime 编码类型
         */
        RecorderApp.Stop(
          (arrayBuffer: ArrayBuffer, duration: number, mime: string) =>
          {
            // 获取最后一帧数据
            const currentRecorder = this.getCurrentRecorder()
            if (currentRecorder && currentRecorder.buffers && currentRecorder.buffers[0] && currentRecorder.buffers[0].length > 0)
            {
              // 格式化最后一帧数据
              const finalFrameBuffer = this.formatBufferType(currentRecorder.buffers[0])

              // 添加最后一帧数据
              this.audioBuffers.push(finalFrameBuffer)

              // 触发最后一帧回调
              this.onFrameRecorded?.({ frameBuffer: finalFrameBuffer, isLastFrame: true })
            }

            // 触发停止回调
            this.onStop?.(arrayBuffer)
            console.warn(`[RecorderApp] Recording duration: ${duration}ms, Encoding type: ${mime}`)
            resolve(true)
          },
          (err: Error) =>
          {
            this.onStop?.(this.audioBuffers)
            console.error(`[RecorderApp] Failed to stop recording: ${err.message}`)
            resolve(false)
          })
      }
      else
      {
        this.onStop?.(this.audioBuffers)
        console.error('[RecorderApp] No active recording instance found')
        resolve(false)
      }
    })
  }

  /**
   * 暂停录音
   */
  public pause(): void
  {
    if (!this.isRecording)
    {
      return
    }

    // 获取当前录音实例
    const currentRecorder = this.getCurrentRecorder()

    if (currentRecorder)
    {
      // 暂停录音
      RecorderApp.Pause()
      this.isRecording = false
      console.warn('[RecorderApp] Recording paused')
    }
  }

  /**
   * 恢复录音
   */
  public resume(): void
  {
    if (this.isRecording)
    {
      return
    }

    // 获取当前录音实例
    const currentRecorder = this.getCurrentRecorder()

    if (currentRecorder)
    {
      // 恢复录音
      RecorderApp.Resume()
      this.isRecording = true
      console.warn('[RecorderApp] Recording resumed')
    }
  }

  /**
   * 初始化波形绘制
   */
  public initWaveVisualizer(config: IWaveConfig)
  {
    const { container, width = 200, height = 150, effectType = 'frequencyHistogramView', effectConfig } = config

    try
    {
      console.warn('[RecorderApp] Initializing waveform drawing')

      // 根据配置的效果类型创建不同的可视化效果
      switch (effectType)
      {
        case 'waveView': {
          // 标准波形效果
          this.waveVisualizer = Recorder.WaveView({
            compatibleCanvas: container,
            width,
            height,
            // 合并自定义配置
            ...effectConfig,
          })
          break
        }

        case 'waveSufferView': {
          // 圆柱波形效果
          this.waveVisualizer = Recorder.WaveSurferView({
            compatibleCanvas: container,
            width,
            height,
            // 合并自定义配置
            ...effectConfig,
          })
          break
        }

        case 'frequencyHistogramView': {
          // 频谱柱状图
          this.waveVisualizer = Recorder.FrequencyHistogramView({
            compatibleCanvas: container,
            width,
            height,
            // 合并自定义配置
            ...effectConfig,
          })
          break
        }

        default: {
          // 默认使用标准波形
          this.waveVisualizer = Recorder.WaveView({
            compatibleCanvas: container,
            width,
            height,
          })
        }
      }

      return this.waveVisualizer
    }
    catch (error)
    {
      console.error('[RecorderApp] Failed to initialize waveform drawing:', error)
    }
  }

  /**
   * 更新波形绘制
   */
  public updateWaveVisualizer(
    buffers: any,
    powerLevel: number,
    duration: number,
    sampleRate: number,
  )
  {
    try
    {
      console.warn(`[RecorderApp] Updating waveform drawing: ${duration}ms`)
      this.waveVisualizer.input(buffers.at(-1), powerLevel, sampleRate)
    }
    catch (error)
    {
      console.error('[RecorderApp] Failed to update waveform drawing:', error)
    }
  }
}
