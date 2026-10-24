import { Platform } from 'react-native'
import { mkdir, existsFile, privateStorageDirectoryPath } from '@/utils/fs'
import { downloadMusicDirPath, downloadLrcDirPath, downloadRootPath } from './path'

/**
 * iOS 导入目录：`Documents/Music`（用户从「文件」App 放进来的歌）。
 * 与 `LocalMusic` 页里的 `IOS_IMPORT_DIR` 保持一致。
 */
export const IOS_IMPORT_DIR_PATH = `${privateStorageDirectoryPath}/Music`

/**
 * 确保下载目录存在。
 *
 * `RNFS.downloadFile` 只负责写文件，**不会创建父目录**：Android 上原先下载到
 * `files/云听音乐/xxx.mp3`，而这个目录从未被创建过 → 每次下载都以
 * 「文件写入失败」告终（用户看到的「下载失败」）。iOS 侧同理。
 *
 * 这里按 根目录 → Music → Lrc 逐级创建，已存在则跳过；只在下载前调用一次，
 * 失败时抛出，由调用方转成可见的错误提示。
 */
let ensuredPath: string | null = null

const ensureDir = async(path: string) => {
  if (await existsFile(path).catch(() => false)) return
  await mkdir(path).catch(async(err: Error) => {
    // 并发创建时可能已被别处建好，再查一次
    if (await existsFile(path).catch(() => false)) return
    throw err
  })
}

export const ensureDownloadDirs = async(): Promise<void> => {
  if (ensuredPath === downloadRootPath) return
  await ensureDir(downloadRootPath)
  await ensureDir(downloadMusicDirPath)
  await ensureDir(downloadLrcDirPath)
  // iOS 额外把「我的导入」目录建出来：用户第一次打开 App 后，
  // 「文件」App 里就能直接看到 `云听音乐/Music` 与 `云听音乐/Download/{Music,Lrc}`，
  // 不需要先下载或先扫描才出现。
  if (Platform.OS === 'ios') await ensureDir(IOS_IMPORT_DIR_PATH).catch(() => {})
  // eslint-disable-next-line require-atomic-updates -- 上面的 await 期间不会有第二次成功创建，最坏只是重复建一次目录
  ensuredPath = downloadRootPath
}

/** 目录被外部清理后（如一键清理、卸载重装）重新创建 */
export const resetDownloadDirsCache = () => {
  ensuredPath = null
}
