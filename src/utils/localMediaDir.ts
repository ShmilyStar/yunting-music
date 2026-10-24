import { Platform } from 'react-native'
import { mkdir, readDir, extname, type FileType } from '@/utils/fs'

/**
 * 目录遍历/音频识别的**平台无关**实现。
 *
 * 单独成文件的原因（这次的线上事故）：这段逻辑原来只写在
 * `localMediaMetadata.ts`（共享变体）里，而 `localMediaMetadata.ios.ts`
 * 是**另一份完整文件**、并没有转出 `readAudioDir` / `countAudioFilesDeep`。
 * Metro 在 iOS 上只会解析到 `.ios.ts`，于是 `LocalMusic` 页拿到的
 * `readAudioDir` 是 `undefined`，一调用就 `TypeError`，
 * 被页面 catch 后弹出「扫描失败，请检查目录是否可读」——两个固定目录都进不去。
 *
 * `tsc` 看不到这个问题：TypeScript 只认无后缀的 `localMediaMetadata.ts`，
 * 平台扩展是 Metro 的运行时解析规则。
 *
 * 所以把**与平台无关**的部分放到这个无后缀文件里，两个变体都从这里转出，
 * 导出面不可能再分叉（`test/localMediaMetadataExports.test.ts` 另加断言守住）。
 */

/** 音频扩展名白名单：iOS 侧 `readDir` 的 mimeType 是按扩展名查表得到的，表里没有的一律 octet-stream */
export const AUDIO_EXTS = [
  'mp3', 'flac', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac',
  'wma', 'ape', 'mka', 'aiff', 'aif', 'dsf', 'dff',
]

/** 递归扫描的最大层数：防止极深的目录树把扫描拖死 */
const MAX_SCAN_DEPTH = 8
/** 递归统计歌曲数的上限：只用来判断「这个文件夹要不要显示」与显示数量 */
export const MAX_COUNT = 5000

export const isAudioFile = (file: FileType) => {
  if (file.isDirectory) return false
  if (file.mimeType?.startsWith('audio/')) return true
  return AUDIO_EXTS.includes(extname(file?.name ?? '').toLowerCase())
}

/** `readDir` 一般会给 `isDirectory`；拿不到时按「没有扩展名且没有 mime」兜底 */
const isDirEntry = (file: FileType) =>
  file.isDirectory ?? (extname(file?.name ?? '') === '' && file.mimeType == null)

export interface AudioDirListing {
  /** 子目录（未过滤，是否显示由调用方按曲目数决定） */
  dirs: FileType[]
  /** 当前目录下的音频文件（**不含**子目录里的） */
  files: FileType[]
}

/**
 * 读一层目录，拆成子目录与音频文件。
 *
 * 目录不存在时返回空结果而不是抛错：首次安装后
 * `Documents/Download/Music` 等目录尚未创建，抛错会让整个列表页
 * 走进「扫描失败」分支。
 *
 * iOS 上顺手把缺失的目录建出来，用户在「文件」App 里就能看到并拖歌进来
 * （Android 不动：外部存储上乱建目录会污染用户的存储卡）。
 */
export const readAudioDir = async(dirPath: string): Promise<AudioDirListing> => {
  let entries: FileType[]
  try {
    entries = await readDir(dirPath)
  } catch {
    if (Platform.OS !== 'ios') return { dirs: [], files: [] }
    try {
      await mkdir(dirPath)
      entries = await readDir(dirPath)
    } catch {
      return { dirs: [], files: [] }
    }
  }
  const dirs: FileType[] = []
  const files: FileType[] = []
  for (const entry of entries) {
    if (isDirEntry(entry)) {
      if (entry.path) dirs.push(entry)
      continue
    }
    if (isAudioFile(entry)) files.push(entry)
  }
  return { dirs, files }
}

/**
 * 递归统计目录子树里的音频文件数。
 * 用途只有一个：判断子目录「里面有没有歌」以及显示数量，所以到 `MAX_COUNT` 就提前返回。
 * 读不通的子目录按 0 算，不抛错。
 */
export const countAudioFilesDeep = async(dirPath: string, limit = MAX_COUNT): Promise<number> => {
  let count = 0
  const visited = new Set<string>()
  const walk = async(path: string, depth: number): Promise<void> => {
    if (count >= limit || depth > MAX_SCAN_DEPTH || visited.has(path)) return
    visited.add(path)
    let listing: AudioDirListing
    try {
      listing = await readAudioDir(path)
    } catch {
      return
    }
    count += listing.files.length
    if (count >= limit) return
    for (const dir of listing.dirs) {
      if (count >= limit) return
      await walk(dir.path, depth + 1)
    }
  }
  await walk(dirPath, 0)
  return Math.min(count, limit)
}

/**
 * 递归扫描目录及其子目录下的音频文件（返回文件列表）。
 * 目前没有调用方（页面改成一层一层浏览），保留给需要「一次性拿全量」的场景。
 */
export const scanAudioFilesDeep = async(dirPath: string): Promise<FileType[]> => {
  const result: FileType[] = []
  const visited = new Set<string>()
  const walk = async(path: string, depth: number): Promise<void> => {
    if (depth > MAX_SCAN_DEPTH || visited.has(path)) return
    visited.add(path)
    let listing: AudioDirListing
    try {
      listing = await readAudioDir(path)
    } catch {
      return
    }
    result.push(...listing.files)
    for (const dir of listing.dirs) await walk(dir.path, depth + 1)
  }
  await walk(dirPath, 0)
  return result
}
