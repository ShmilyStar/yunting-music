import { temporaryDirectoryPath, readDir, unlink } from '@/utils/fs'
import { readPic as _readPic } from 'react-native-local-media-metadata'
import { isAudioFile } from './localMediaDir'

export {
  type MusicMetadata,
  type MusicMetadataFull,
  readMetadata,
  writeMetadata,
  writePic,
  readLyric,
  writeLyric,
} from 'react-native-local-media-metadata'

/**
 * 目录遍历/音频识别与平台无关，统一放在 `localMediaDir.ts`，
 * 由本文件与 `localMediaMetadata.ios.ts` **同一处转出**。
 *
 * 以前这两个变体各写一份，iOS 变体漏掉了 `readAudioDir` /
 * `countAudioFilesDeep`：Metro 在 iOS 上只解析 `.ios.ts`，
 * `LocalMusic` 页拿到 `undefined` 直接抛 TypeError，
 * 表现就是「点已下载 / 我的导入 → 扫描失败，请检查目录是否可读」。
 */
export {
  AUDIO_EXTS,
  isAudioFile,
  MAX_COUNT,
  type AudioDirListing,
  readAudioDir,
  countAudioFilesDeep,
  scanAudioFilesDeep,
} from './localMediaDir'

let cleared = false
const picCachePath = temporaryDirectoryPath + '/local-media-metadata'

/**
 * 扫描一层目录下的音频文件（不递归）。
 *
 * `FileSystem.ls` 在部分设备 / 系统版本上不给 `mimeType`（Android 13+ 上实测为
 * undefined），只按 mime 过滤会把整个目录判成「没有音频」，所以扩展名也要认。
 */
export const scanAudioFiles = async(dirPath: string) => {
  const files = await readDir(dirPath)
  return files.filter(isAudioFile)
}

const clearPicCache = async() => {
  await unlink(picCachePath)
  cleared = true
}

export const readPic = async(dirPath: string): Promise<string> => {
  if (!cleared) await clearPicCache()
  return _readPic(dirPath, picCachePath)
}
