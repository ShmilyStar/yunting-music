import { Platform } from 'react-native'

/**
 * 下载能力平台开关。
 *
 * Android 与 iOS 都支持：Android 侧走应用内后台下载服务（`core/download/engine.ts`
 * 绑定的原生下载实现），iOS 侧走 `NSURLSession` 后台会话（`engine.ios.ts`）。
 *
 * 曾经这里被钉成 `Platform.OS === 'ios'`，导致 Android 上整条下载初始化链被跳过：
 * 音乐馆的「下载管理」入口能看到、点进去是空页，歌曲菜单的「下载」也不出现。
 * 语义上「下载管理」在两端都是**对已下载歌曲的过滤与管理（播放 / 删除）**，
 * 与平台无关；真正随平台变的只是底层引擎实现。
 *
 * 独立成文件避免平台扩展文件自引用环：`engine.ios.ts` 不能从 `./engine` 导入值，
 * iOS 上 Metro 会把该导入解析回 `engine.ios.ts` 自身。
 */
export const isDownloadSupported = () => Platform.OS === 'android' || Platform.OS === 'ios'
