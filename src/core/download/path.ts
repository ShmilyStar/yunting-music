import { Platform } from 'react-native'
import RNFS from 'react-native-fs'
import { privateStorageDirectoryPath, externalStorageDirectoryPath } from '@/utils/fs'

/**
 * 下载目录布局：
 *
 * - Android 10+（API 29+）：`<Android/data/包名/files>/Download/yuntingmusic/`
 * - Android 9-：`<外部存储>/Download/yuntingmusic/`
 * - iOS：`<Documents>/Download/Music/`（歌词在同级 `Lrc/`）
 *
 * 每个根目录下再分 `music/`（歌曲）与 `lrc/`（歌词）。
 *
 * **为什么 Android 10+ 不再直接写公共 `/sdcard/Download`**：
 * targetSdk 29 的 `requestLegacyExternalStorage` 只在 Android 10 生效，
 * 在 Android 11+ 会被系统忽略、走分区存储，应用对公共 Download 目录没有
 * 写权限 —— 实测（Android 14 / API 34）`downloadFile` 直接报
 * `ENOENT ... /storage/emulated/0/Download/yuntingmusic/music/xxx.flac`，
 * 表现为「下载失败」。应用专属外部目录无需任何权限即可读写，
 * 用户在文件管理器里也能通过 `Android/data/包名/files` 找到。
 */

/** Android 公共下载目录下的应用子目录名 */
const ANDROID_APP_DIR_NAME = 'yuntingmusic'

/** Android 10 起公共存储改为分区存储，公共 Download 目录对应用只读 */
const androidNeedsScopedStorage = Platform.OS === 'android' && Number(Platform.Version) >= 29

/** 应用专属外部目录（`Android/data/<包名>/files`），无需权限；取不到时退回私有目录 */
const androidAppExternalDir = RNFS.ExternalDirectoryPath || privateStorageDirectoryPath

/**
 * Android 是否写**公共**下载目录（`/storage/emulated/0/Download/yuntingmusic`）。
 *
 * 用户明确要求落点就是「系统下载目录 / yuntingmusic / music + lrc」
 * （2026-10-22 反馈「安卓下载的歌在系统下载目录里找不到」）。
 * 但 Android 10+ 的分区存储下，应用对公共 Download **只读**，
 * 除非拿到「所有文件访问」（`MANAGE_EXTERNAL_STORAGE`，本 App 已在
 * AndroidManifest 里声明、本地音乐也依赖它）。
 * 因此这里做成运行时开关：启动 / 回前台时按权限实际状态切换，
 * 有权限 → 公共目录（用户能找到、也能被文件管理器 / 电脑直接拷走）；
 * 没权限 → 退回应用专属目录（下载仍然可用，只是路径深一点）。
 */
let androidUsePublicDownload = Platform.OS === 'android' && !androidNeedsScopedStorage

/**
 * iOS 下载根目录。
 *
 * 必须是 `<Documents>/download/`，与原生 `LxDownloadManager.m` 的白名单
 * （`allowedRoot = Documents/Download/`）**大小写与层级都要一致**：
 * 原生侧对落盘路径做了路径校验，不在白名单内会直接拒绝并回 `error` 事件，
 * 表现为「下载失败：没有读写权限」。
 *
 * 注意：`Download` 必须大写，与原生 `LxDownloadManager.m` 的白名单
 * （`allowedRoot = Documents/Download/`）逐字一致 —— 原生用 `hasPrefix`
 * 做字符串比较，大小写敏感，写错就是 `ORPHAN` + 下载失败。
 */
const IOS_DOWNLOAD_ROOT = `${privateStorageDirectoryPath}/Download`

/**
 * iOS 下歌词子目录用 `Lrc`（首字母大写），歌曲用 `Music`；
 * Android 保持历史命名 `music` / `lrc` 不变（用户明确要求「安卓端不动」）。
 */
const IOS_MUSIC_DIR_NAME = 'Music'
const IOS_LRC_DIR_NAME = 'Lrc'
const ANDROID_MUSIC_DIR_NAME = 'music'
const ANDROID_LRC_DIR_NAME = 'lrc'

const computeRootPath = () => Platform.OS === 'ios'
  // iOS 的 Documents/Download 是「文件」App 里该应用可见的目录（UIFileSharingEnabled）
  ? IOS_DOWNLOAD_ROOT
  : androidUsePublicDownload
    ? `${externalStorageDirectoryPath}/Download/${ANDROID_APP_DIR_NAME}`
    : `${androidAppExternalDir}/Download/${ANDROID_APP_DIR_NAME}`

/** 下载根目录（绝对路径）。Android 上会在权限就绪后切换，故用 let（ES 模块实时绑定） */
export let downloadRootPath = computeRootPath()

/** 歌曲子目录（绝对路径） */
export let downloadMusicDirPath = `${downloadRootPath}/${Platform.OS === 'ios' ? IOS_MUSIC_DIR_NAME : ANDROID_MUSIC_DIR_NAME}`
/** 歌词子目录（绝对路径） */
export let downloadLrcDirPath = `${downloadRootPath}/${Platform.OS === 'ios' ? IOS_LRC_DIR_NAME : ANDROID_LRC_DIR_NAME}`

/** 当前是否落在公共下载目录（Android） */
export const isPublicDownloadRoot = () => androidUsePublicDownload

/**
 * 根目录变化通知。
 *
 * `path.ts` 导出的是 `let`（ES 模块实时绑定），函数式调用拿到的永远是最新值；
 * 但页面里如果把路径**存进模块级常量**或塞进 `useMemo`，就会拿到切换前的旧路径
 * （本地歌曲页的「已下载」原来就是这样，切到公共目录后它还在读旧目录，列表全空）。
 * 订阅这个「版本号」即可让 UI 跟着根目录一起刷新。
 */
let rootVersion = 0
const rootListeners = new Set<() => void>()

/** 供 `useSyncExternalStore` 用：当前根目录版本号 */
export const getDownloadRootVersion = () => rootVersion

/** 供 `useSyncExternalStore` 用：订阅根目录变化，返回取消订阅函数 */
export const subscribeDownloadRootChange = (listener: () => void) => {
  rootListeners.add(listener)
  return () => { rootListeners.delete(listener) }
}

/**
 * 切换 Android 下载根目录（公共 / 应用专属）。返回**是否真的发生了变化**，
 * 调用方据此决定要不要重建目录、迁移旧文件。
 *
 * iOS 上永远返回 false（根目录固定）。
 */
export const setAndroidPublicDownloadEnabled = (enabled: boolean) => {
  if (Platform.OS !== 'android') return false
  const next = enabled || !androidNeedsScopedStorage
  if (next === androidUsePublicDownload) return false
  androidUsePublicDownload = next
  downloadRootPath = computeRootPath()
  downloadMusicDirPath = `${downloadRootPath}/${ANDROID_MUSIC_DIR_NAME}`
  downloadLrcDirPath = `${downloadRootPath}/${ANDROID_LRC_DIR_NAME}`
  rootVersion += 1
  rootListeners.forEach(listener => { listener() })
  return true
}

const stripLeadingSlash = (relPath: string) => relPath.startsWith('/') ? relPath.slice(1) : relPath

/**
 * 仓库里保存的路径是**相对 `music/` 的路径**（不含 `music/` 前缀），
 * 换设备或系统容器路径变化时已存记录仍然有效。
 */
export const resolveDownloadPath = (relPath: string): string => {
  return `${downloadMusicDirPath}/${stripLeadingSlash(relPath)}`
}

/** 歌词相对路径 → 绝对路径（相对 `lrc/`） */
export const resolveLrcPath = (relPath: string): string => {
  return `${downloadLrcDirPath}/${stripLeadingSlash(relPath)}`
}

/** 拼接子路径（按列表分目录时用，各段由调用方清洗过） */
export const joinDownloadPath = (...segments: string[]): string => {
  return segments.filter(s => s.length > 0).join('/')
}
