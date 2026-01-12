/**
 * 浏览器音频录制器
 * @description 使用MediaRecorder API实现音频录制功能
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/MediaRecorder
 */

/**
 * ArrayBuffer：原始二进制数据，无法直接读写，需要通过视图（TypeArray）来操作
 * DataView：无类型视图，不会自动创建换成次哦拿过去，需要手动指定数据类型和偏移量
 * TypeArray(Uint8Array、Int16Array、Float32Array...)：类型化视图，会自动创建缓冲区，并按照指定的数据类型进行读写操作
 * PCM：脉码调制，是一种音频编码方式，用于将模拟音频信号转换为数字信号，是最原始的音频数据格式，常用Int16Array存储
 * Uint8Array：所有标准音频文件格式（wav、mp3、aac等）在二进制层面均是以字节流存储的
 * Blob：二进制大对象，在Web浏览器中，Blob 对象表示一个不可变的、原始数据的类文件对象
 */
/**
 * 音频录制器类，提供录音和麦克风设备管理功能
 */
export default class AudioRecorder
{
  private mediaRecorder: MediaRecorder | undefined // 媒体录制器对象，用于处理音频录制
  private analyser: AnalyserNode | undefined // 分析节点，用于获取实时音频数据
  private microphoneInput: MediaStreamAudioSourceNode | undefined // 麦克风输入源，连接音频流到音频上下文
  private audioContext: AudioContext | undefined // 音频上下文，用于处理音频数据

  private microDevices: MediaDeviceInfo[] = [] // 麦克风设备列表
  private selectedDeviceId: string = '' // 当前选择的麦克风设备ID

  private chunks: Blob[] = [] // 存储录音片段
  private buffer: Uint8Array | undefined // 用于存储实时波形数据

  private isRecording = false // 是否正在录音

  private animationId: number | undefined // 动画帧ID，用于实时波形绘制

  /**
   * 录音权限回调
   */
  public onPermission?: (isGranted: boolean) => void

  /**
   * 录音开始回调
   */
  public onStart?: () => void

  /**
   * 录音停止回调
   */
  public onStop?: (chunks: Blob[]) => void

  /**
   * 绘制实时波形回调
   */
  public onFrame?: (buffer: Uint8Array) => void

  /**
   * 检查麦克风权限
   */
  async checkPermission()
  {
    try
    {
      // 首先请求用户授权访问麦克风
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // 授权成功后，获取所有媒体设备
      const devicesList = await navigator.mediaDevices.enumerateDevices()
      // 筛选出音频输入设备（麦克风）
      this.microDevices = devicesList.filter(device => device.kind === 'audioinput')
      // 如果有设备且当前没有选择设备，则默认选择第一个设备
      if (!this.selectedDeviceId)
      {
        this.selectedDeviceId = this.microDevices[0].deviceId
      }
      // 关闭麦克风流释放资源
      for (const track of stream.getTracks()) track.stop()

      // 如果权限回调函数存在，则调用回调函数并传递授权结果
      this.onPermission?.(true)
      return true
    }
    catch (error)
    {
      console.error('Error fetching microphone devices:', error)
      // 如果权限回调函数存在，则调用回调函数并传递授权结果
      this.onPermission?.(false)
      return false
    }
  }

  /**
   * 获取麦克风设备列表
   */
  getMicrophones()
  {
    return this.microDevices
  }

  /**
   * 获取当前选择的麦克风设备ID
   */
  getSelectedMicrophone()
  {
    return this.selectedDeviceId
  }

  /**
   * 选择麦克风设备
   */
  selectMicrophone(deviceId: string)
  {
    this.selectedDeviceId = deviceId
  }

  /**
   * 开始录音
   */
  async start()
  {
    try
    {
      // 使用选择的麦克风设备ID创建媒体流
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: this.selectedDeviceId } })
      // 将媒体流传递给录音器
      this.mediaRecorder = new MediaRecorder(stream)

      // 创建音频上下文
      this.audioContext = new AudioContext()
      // 创建分析节点
      this.analyser = this.audioContext.createAnalyser()
      // 频率分辨率，必须是2的幂次方，默认是2048
      // 256：高频细节少，性能好
      // 2048：平衡细节和性能
      // 4096：高频细节多，性能较差
      this.analyser.fftSize = 2048
      // 创建麦克风输入源
      this.microphoneInput = this.audioContext.createMediaStreamSource(stream)
      // 将麦克风输入源连接到分析节点
      this.microphoneInput.connect(this.analyser)

      // 初始化缓冲区（用于实时数据可视化）,frequencyBinCount = fftSize / 2
      this.buffer = new Uint8Array(this.analyser.frequencyBinCount)

      // 收集录音数据片段
      this.mediaRecorder.ondataavailable = (event) =>
      {
        this.chunks.push(event.data)
      }

      // 当录音开始时的事件回调
      this.mediaRecorder.onstart = () =>
      {
        this?.onStart?.()
      }

      // 当录音停止时的事件回调
      this.mediaRecorder.onstop = () =>
      {
        this?.onStop?.(this.chunks)
      }

      // 开始录制
      this.mediaRecorder.start()
      this.isRecording = true

      // 开始绘制实时波形
      this.updateWaveform()
    }
    catch (error)
    {
      console.error('Error starting recording:', error)
    }
  }

  /**
   * 暂停录音
   */
  pause()
  {
    if (this.mediaRecorder && this.isRecording)
    {
      this.mediaRecorder.pause()
      this.isRecording = false
    }
  }

  /**
   * 恢复录音
   */
  resume()
  {
    if (this.mediaRecorder && !this.isRecording)
    {
      this.mediaRecorder.resume() // 恢复录音
      this.isRecording = true
    }
  }

  /**
   * 停止录音
   */
  stop()
  {
    return new Promise<void>((resolve, reject) =>
    {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive')
      {
        console.warn('No recording in progress', this.mediaRecorder)
        resolve()
        return
      }

      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().map(track => track.stop())

      this.isRecording = false
      this.destroy()
    })
  }

  /**
   * 绘制实时波形
   */
  updateWaveform()
  {
    if (!this.isRecording || !this.analyser || !this.buffer)
    {
      return
    }

    this.animationId = requestAnimationFrame(this.updateWaveform.bind(this))
    this.analyser.getByteTimeDomainData(this.buffer as Uint8Array<ArrayBuffer>)
    this?.onFrame?.(this.buffer)
  }

  /**
   * 销毁录音资源
   */
  destroy()
  {
    this.microphoneInput?.disconnect()
    this.analyser?.disconnect()
    this.mediaRecorder = undefined
    this.microphoneInput = undefined
    this.analyser = undefined
    this.buffer = undefined
    if (this.animationId)
    {
      cancelAnimationFrame(this.animationId)
    }
  }
}
