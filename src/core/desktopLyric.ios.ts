/**
 * iOS 桌面歌词桩：iOS 没有系统悬浮窗，桌面歌词的窗口、设置与原生桥接
 * 都不进入 iOS 包。这里只保留共享歌词流程调用的空实现，避免 iOS 包
 * 继续打包 Android 的悬浮窗逻辑。
 */
interface LyricLine { text: string, extendedLyrics: string[] }
interface Position { x: number, y: number }
interface DesktopLyricAction { action: string, value?: string }

const noop = async(..._args: unknown[]) => {}

export const showDesktopLyric = noop
export const hideDesktopLyric = noop
export const playDesktopLyric = noop
export const pauseDesktopLyric = noop
export const setDesktopLyric = noop
export const setDesktopLyricPlaybackRate = noop
export const toggleDesktopLyricTranslation = noop
export const toggleDesktopLyricRoma = noop
export const toggleDesktopLyricLock = noop
export const setDesktopLyricColor = noop
export const setDesktopLyricAlpha = noop
export const setDesktopLyricTextSize = noop
export const setShowDesktopLyricToggleAnima = noop
export const setDesktopLyricSingleLine = noop
export const setDesktopLyricMaxLineNum = noop
export const setDesktopLyricWidth = noop
export const setDesktopLyricTouchable = noop
export const checkDesktopLyricOverlayPermission = noop
export const openDesktopLyricOverlayPermissionActivity = noop

export const onDesktopLyricPositionChange = (_handler: (position: Position) => void): (() => void) => () => {}
export const onLyricLinePlay = (_handler: (line: LyricLine) => void): (() => void) => () => {}
export const onDesktopLyricAction = (_handler: (event: DesktopLyricAction) => void): (() => void) => () => {}

export const showRemoteLyric = async(_isSend: boolean) => {}
