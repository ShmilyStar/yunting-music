import { NativeModules, NativeEventEmitter, Platform } from 'react-native'

const { LyricModule } = NativeModules

/**
 * 桌面歌词只有 Android 有（系统悬浮窗能力），iOS 上 `LyricModule` 不存在。
 *
 * 这里把能力判断收口成一个常量，所有导出统一在入口处兜底：
 * - 调用方不需要各自写 `Platform.OS` 判断（漏判会直接崩）
 * - 因此也不再需要一份 iOS 专用的 no-op 桩文件（原来那份只实现了部分导出，
 *   新增导出时容易漏，漏了就是运行期崩溃）
 */
const isSupported = Platform.OS === 'android' && LyricModule != null

const getAlpha = (num: number) => num / 100
const getTextSize = (num: number) => num / 10

/** 发送歌词事件 */
export const setSendLyricTextEvent = async(isSend: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setSendLyricTextEvent(isSend)
}

/** 显示桌面歌词窗口 */
export const showDesktopLyricView = async({
  isShowToggleAnima,
  isSingleLine,
  width,
  maxLineNum,
  isLock,
  unplayColor,
  playedColor,
  shadowColor,
  opacity,
  textSize,
  positionX,
  positionY,
}: {
  isShowToggleAnima: boolean
  isSingleLine: boolean
  width: number
  maxLineNum: number
  isLock: boolean
  unplayColor: string
  playedColor: string
  shadowColor: string
  opacity: number
  textSize: number
  positionX: number
  positionY: number
}): Promise<void> => {
  if (!isSupported) return
  return LyricModule.showDesktopLyric({
    isSingleLine,
    isShowToggleAnima,
    isLock,
    unplayColor,
    playedColor,
    shadowColor,
    alpha: getAlpha(opacity),
    textSize: getTextSize(textSize),
    lyricViewX: positionX,
    lyricViewY: positionY,
    width,
    maxLineNum,
  })
}

/** 隐藏桌面歌词窗口 */
export const hideDesktopLyricView = async(): Promise<void> => {
  if (!isSupported) return
  return LyricModule.hideDesktopLyric()
}

/** 按播放进度驱动歌词 */
export const play = async(time: number): Promise<void> => {
  if (!isSupported) return
  return LyricModule.play(time)
}

export const pause = async(): Promise<void> => {
  if (!isSupported) return
  return LyricModule.pause()
}

export const setLyric = async(lyric: string, translation: string, romalrc: string): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setLyric(lyric, translation || '', romalrc || '')
}

export const setPlaybackRate = async(rate: number): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setPlaybackRate(rate)
}

export const toggleTranslation = async(isShowTranslation: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.toggleTranslation(isShowTranslation)
}

export const toggleRoma = async(isShowRoma: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.toggleRoma(isShowRoma)
}

export const toggleLock = async(isLock: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.toggleLock(isLock)
}

export const setColor = async(unplayColor: string, playedColor: string, shadowColor: string): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setColor(unplayColor, playedColor, shadowColor)
}

export const setAlpha = async(alpha: number): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setAlpha(getAlpha(alpha))
}

export const setTextSize = async(size: number): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setTextSize(getTextSize(size))
}

export const setShowToggleAnima = async(isShowToggleAnima: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setShowToggleAnima(isShowToggleAnima)
}

export const setSingleLine = async(isSingleLine: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setSingleLine(isSingleLine)
}

export const setMaxLineNum = async(maxLineNum: number): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setMaxLineNum(maxLineNum)
}

export const setWidth = async(width: number): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setWidth(width)
}

/** 设置悬浮窗是否响应触摸（设置页打开时关闭，避免挡住页面控件） */
export const setLyricTouchable = async(touchable: boolean): Promise<void> => {
  if (!isSupported) return
  return LyricModule.setLyricTouchable(touchable)
}

/** 检查悬浮窗权限（Android 专属） */
export const checkOverlayPermission = async(): Promise<void> => {
  if (!isSupported) return
  return LyricModule.checkOverlayPermission()
}

/** 跳转悬浮窗权限设置页（Android 专属） */
export const openOverlayPermissionActivity = async(): Promise<void> => {
  if (!isSupported) return
  return LyricModule.openOverlayPermissionActivity()
}

/** 订阅窗口拖动事件；不支持的平台返回空的取消函数 */
export const onPositionChange = (handler: (position: { x: number, y: number }) => void): () => void => {
  if (!isSupported) return () => {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('set-position', event => {
    handler(event as { x: number, y: number })
  })

  return () => {
    eventListener.remove()
  }
}

/** 订阅当前播放到的歌词行；不支持的平台返回空的取消函数 */
export const onLyricLinePlay = (handler: (lineInfo: { text: string, extendedLyrics: string[] }) => void): () => void => {
  if (!isSupported) return () => {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('lyric-line-play', event => {
    handler(event as { text: string, extendedLyrics: string[] })
  })

  return () => {
    eventListener.remove()
  }
}
