/**
 * 平台能力开关。
 *
 * 参考实现里这四个都由「是否 Android」派生；本工程同时交付 Android 与 iOS 源码，
 * 因此保留 `Platform.OS` 判断（Android 侧四项全为 true）。
 */
import { Platform } from 'react-native'

export const isDesktopLyricSupported = Platform.OS === 'android'
export const isAudioMetadataWriteSupported = Platform.OS === 'android'
export const isAndroidMediaSessionSupported = Platform.OS === 'android'
export const isPlayerCacheSupported = Platform.OS === 'android'
