/**
 * 保存录音文件
 * @param buffer 录音数据
 */
export function saveAudio(buffer: ArrayBuffer)
{
  // ArrayBuffer 解码为 AudioBuffer (Web Audio API)
  const audioContext = new AudioContext()
  const audioBuffer = audioContext.decodeAudioData(buffer)
}

/**
 * 格式化时间，将秒数格式化为 "MM:SS.M" 的字符串格式
 * @param duration 音频时长，单位为秒
 */
export function formatPlayerTime(duration: number): string
{
  // 将秒数转换为毫秒数
  const totalMilliseconds = duration * 1000

  // 计算毫秒部分（这里保留一位小数）
  const milliseconds = Math.floor(Math.floor(totalMilliseconds % 1000) / 100)

  // 计算秒数
  const seconds = Math.floor(totalMilliseconds / 1000) % 60

  // 计算分钟数
  const minutes = Math.floor(totalMilliseconds / (1000 * 60)) % 60

  // 格式化时间字符串，确保秒和分钟为两位数
  const formattedSeconds = seconds.toString().padStart(2, '0')
  const formattedMinutes = minutes.toString().padStart(2, '0')

  // 返回格式化的时间字符串
  return `${formattedMinutes}:${formattedSeconds}.${milliseconds}`
}

/**
 * 获取音频文件时长
 * @param mediaUrl 文件地址
 */
export function fetchMediaDuration(mediaUrl: string)
{
  return new Promise<number>((resolve, reject) =>
  {
    const media = document.createElement('audio')
    media.src = mediaUrl
    media.load()

    media.addEventListener('loadedmetadata', () =>
    {
      resolve(media.duration)
      media.remove()
    })

    media.addEventListener('error', () =>
    {
      reject(new Error(`Failed to load media ${mediaUrl}`))
      media.remove()
    })
  })
}

/** ------------------------- 小程序 ----------------------------------- */

/**
 * 获取录音文件时长（小程序）
 * @param mediaUrl 文件地址
 */
export function fetchMediaDurationMini(mediaUrl: string)
{
  // return new Promise<number>((resolve, reject) => {
  //   const audioContext = uni.createInnerAudioContext();
  //   audioContext.src = mediaUrl;
  //   audioContext.onCanplay(() => {
  //     resolve(audioContext.duration);
  //     audioContext.destroy();
  //   })
  //   audioContext.onError((err: any) => {
  //     reject(err);
  //     audioContext.destroy();
  //   })
  // })
}

/**
 * 保存录音文件（小程序）
 * @param buffer 录音数据
 */
export function saveAudioMini(buffer: ArrayBuffer)
{
  // return new Promise<string>((resolve) => {
  //   const filePath = `${wx.env.USER_DATA_PATH}/audio_${Date.now()}.mp3`;

  //   const fileManager = uni.getFileSystemManager();
  //   fileManager.writeFile({
  //     filePath,
  //     data: buffer,
  //     encoding: 'binary',
  //     success: (res) => {
  //       resolve(filePath);
  //     },
  //     fail: (err) => {
  //       resolve('');
  //     }
  //   });
  // });
}

/**
 * 删除录音文件（小程序）
 * @param path 文件路径
 */
export function deleteAudioMini(path: string)
{
  // return new Promise<void>((resolve) => {
  //   const fileManager = uni.getFileSystemManager();
  //   fileManager.unlink({
  //     filePath: path,
  //     success: (res) => {
  //       resolve();
  //     },
  //     fail: (err) => {
  //       resolve();
  //     }
  //   });
  // });
}
