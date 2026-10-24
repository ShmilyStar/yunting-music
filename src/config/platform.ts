/**
 * 平台能力开关。
 *
 * 参考实现里这四个都由「是否 Android」派生；本工程同时交付 Android 与 iOS，
 * 因此保留 `Platform.OS` 判断（Android 侧四项全为 true）。
 *
 * 用途：**iOS 上做不了的功能，入口和实现都要按这里隐藏**，不要只在实现里兜底——
 * 用户看到开关却点不出效果，比看不到这个开关更糟。
 *
 * | 开关 | 控制什么 | 用在 |
 * |---|---|---|
 * | `isDesktopLyricSupported` | 桌面歌词悬浮窗（系统悬浮窗权限） | 桌面歌词设置分组；`utils/nativeModules/lyricDesktop` 的守卫 |
 * | `isAudioMetadataWriteSupported` | 写入本地歌曲标签 | 歌曲菜单的「编辑标签」项 |
 * | `isAndroidMediaSessionSupported` | 音频焦点 / 音频卸载（ExoPlayer 专属） | 播放器设置分组两项 |
 * | `isPlayerCacheSupported` | 播放器缓存大小（ExoPlayer 专属） | 播放器设置的「最大缓存」 |
 */
import { Platform } from 'react-native'

export const isDesktopLyricSupported = Platform.OS === 'android'
export const isAudioMetadataWriteSupported = Platform.OS === 'android'
export const isAndroidMediaSessionSupported = Platform.OS === 'android'
export const isPlayerCacheSupported = Platform.OS === 'android'
