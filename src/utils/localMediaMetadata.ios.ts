// iOS 本地音乐元数据降级实现（任务 7.2 / plan §6.5）：
// react-native-local-media-metadata 无 iOS 原生实现，
// 读取降级为"仅文件名"，写入类操作显式 reject，保证扫描不崩、无未捕获异常
import { NativeModules } from 'react-native'
import { temporaryDirectoryPath, unlink, stat, hash } from '@/utils/fs'
import { readAudioDir } from './localMediaDir'
import { readFlacTags, writeFlacPicture } from './flacTags'

const { UtilsModule } = NativeModules as { UtilsModule?: Record<string, (...args: any[]) => Promise<any>> }

/**
 * 目录遍历/音频识别与平台无关，统一放在 `localMediaDir.ts`，
 * 由本文件与 `localMediaMetadata.ts` **同一处转出**。
 *
 * 这里原来没有转出 `readAudioDir` / `countAudioFilesDeep`（只有共享变体有），
 * 而 Metro 在 iOS 上只解析 `.ios.ts`：`LocalMusic` 页 `import` 到的是
 * `undefined`，一调用就 `TypeError: readAudioDir is not a function`，
 * 被页面 catch 后弹「扫描失败，请检查目录是否可读」——
 * 两个固定目录（已下载 / 我的导入）都进不去。
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

export interface MusicMetadata {
  albumName: string
  singer: string
  name: string
}
export interface MusicMetadataFull {
  type: 'mp3' | 'flac' | 'ogg' | 'wav'
  bitrate: string
  interval: number
  size: number
  ext: 'mp3' | 'flac' | 'ogg' | 'wav'
  albumName: string
  singer: string
  name: string
  /** 封面缓存文件路径（绝对路径，无封面时为空）；列表用它当 `picUrl` */
  picPath?: string
}

const picCachePath = temporaryDirectoryPath + '/local-media-metadata'

/**
 * 启动时清一次上一轮留下的封面缓存。
 *
 * 封面按「文件路径的 md5」命名，重复扫描会命中同一份，所以清空只影响
 * 首轮的重新提取（几十毫秒/首），换来的是不会无限堆积。
 *
 * **必须让 `readMetadata` 等它完成**：早期写法是在 `readPic()` 里清缓存，
 * 而 `readPic()` 是播放本地歌曲时才调的 —— 那时封面已经写好了，
 * 一清就把列表的缩略图全删了（iOS 上 `readPic` 本来只返回空串）。
 */
const picCacheReady = (async() => {
  try {
    await unlink(picCachePath)
  } catch { /* 缓存目录不存在时忽略 */ }
})()

/**
 * 扫描一层目录下的音频文件（不递归）。
 *
 * 直接复用 `readAudioDir`：它已经做了「扩展名白名单 + 目录缺失时建目录后重试」，
 * 比这里再写一遍 try/catch 更可靠（iOS 首次安装时目录还不存在）。
 */
export const scanAudioFiles = async(dirPath: string) => {
  const listing = await readAudioDir(dirPath)
  return listing.files
}

/** 文件名兜底：原生解析不了（或标签为空）时用，至少能选中、能播 */
const metadataFromFileName = async(filePath: string): Promise<MusicMetadataFull> => {
  const name = filePath.split('/').pop() ?? filePath
  const dotIndex = name.lastIndexOf('.')
  const ext = (dotIndex > 0 ? name.substring(dotIndex + 1) : '').toLowerCase()
  let size = 0
  try {
    size = (await stat(filePath)).size ?? 0
  } catch { /* 取不到大小不影响导入 */ }
  const base = dotIndex > 0 ? name.substring(0, dotIndex) : name
  // 「歌手 - 歌名」「歌名 - 歌手」都拆一下，比整段当歌名好用
  let title = base
  let singer = ''
  const parts = base.split(/\s+-\s+/)
  if (parts.length >= 2) {
    title = parts.slice(1).join(' - ')
    singer = parts[0]
  }
  return {
    type: 'mp3',
    bitrate: '0',
    interval: 0,
    size,
    ext: (ext || 'mp3') as MusicMetadataFull['ext'],
    albumName: '',
    singer,
    name: title,
  }
}

/**
 * FLAC 单独走 JS 解析。
 *
 * AVFoundation 能**播放** FLAC，但**不解析**它的 Vorbis Comment：
 * `commonMetadata` 里没有 title / artist，`commonKeyArtwork` 也拿不到封面，
 * 于是 iOS 的 flac 只能显示文件名、没有缩略图（用户 2026-10-22 反馈）。
 * FLAC 的元数据块结构很简单，用 `flacTags.ts` 自己读，比等系统支持可靠。
 *
 * 解析不出来（文件损坏 / 不是真 FLAC）时返回 null，交回原生链路兜底。
 */
const readFlacInfo = async(filePath: string, picBasePath: string, fallbackSize: number): Promise<MusicMetadataFull | null> => {
  const tags = await readFlacTags(filePath).catch(() => null)
  if (!tags) return null
  const name = tags.title.trim()
  if (!name) return null
  const picPath = await writeFlacPicture(tags.picture, picBasePath)
  const interval = Math.max(0, Math.round(tags.durationSec))
  // 码率：FLAC 是可变码率，只能按「文件大小 / 时长」估算
  const bitrate = interval > 0 && fallbackSize > 0
    ? String(Math.round(fallbackSize * 8 / interval / 1000))
    : '0'
  return {
    type: 'flac',
    bitrate,
    interval,
    size: fallbackSize,
    ext: 'flac',
    albumName: tags.album,
    singer: tags.artist,
    name,
    picPath: picPath || undefined,
  }
}

const isFlacPath = (filePath: string) => /\.flac$/i.test(filePath)

/**
 * 读标签：走原生 `UtilsModule.readAudioMetadata`（AVFoundation），
 * FLAC 由 `flacTags.ts` 自己解析（见 `readFlacInfo`）。
 *
 * iOS 上没有任何 JS 可用的标签库，`react-native-local-media-metadata`
 * 只有 Android 实现。降级成「只用文件名」时列表里显示的是 `歌手 - 歌名.mp3`
 * 这种原始名字、也没有封面（用户 2026-10-22 反馈）。
 *
 * 原生失败（格式怪 / 文件损坏）时不抛错，退回文件名兜底，保证文件仍可播放。
 * 内嵌封面写到缓存目录并回传路径，列表用它当缩略图。
 */
export const readMetadata = async(filePath: string): Promise<MusicMetadataFull | null> => {
  await picCacheReady
  // 封面缓存基名：按文件路径做 md5，换文件不会互相覆盖，重复扫描命中同一份
  const digest = await hash(filePath, 'md5').catch(() => '')
  const picBasePath = `${picCachePath}/${digest || Date.now().toString(36)}`
  const fileNameFallback = await metadataFromFileName(filePath)

  if (isFlacPath(filePath)) {
    const flacInfo = await readFlacInfo(filePath, picBasePath, fileNameFallback.size).catch(() => null)
    if (flacInfo) return flacInfo
  }

  if (!UtilsModule?.readAudioMetadata) return fileNameFallback
  try {
    const result = await UtilsModule.readAudioMetadata(filePath, picBasePath) as {
      name?: string
      singer?: string
      albumName?: string
      interval?: number
      bitrate?: string
      type?: MusicMetadataFull['type']
      ext?: string
      size?: number
      picPath?: string | null
    }
    const name = (result?.name ?? '').trim()
    if (!name) return { ...fileNameFallback, picPath: result?.picPath ?? undefined }
    return {
      type: result?.type ?? fileNameFallback.type,
      bitrate: result?.bitrate ?? '0',
      interval: Number(result?.interval) || 0,
      size: Number(result?.size) || fileNameFallback.size,
      ext: ((result?.ext ?? '') || fileNameFallback.ext) as MusicMetadataFull['ext'],
      albumName: result?.albumName ?? '',
      singer: result?.singer ?? '',
      name,
      picPath: result?.picPath ?? undefined,
    }
  } catch {
    return fileNameFallback
  }
}

const unsupported = async(): Promise<void> => {
  throw new Error('Writing media tags is not supported on iOS')
}

export const writeMetadata: (filePath: string, metadata: MusicMetadata, isOverwrite?: boolean) => Promise<void> = unsupported
export const writePic: (filePath: string, picPath: string) => Promise<void> = unsupported
export const writeLyric: (filePath: string, lyric: string) => Promise<void> = unsupported

// 封面 / 歌词读取降级为空结果（调用方均有 catch/空值分支）
export const readPic = async(_dirPath: string): Promise<string> => {
  return Promise.resolve('')
}

export const readLyric = async(_filePath: string, _isReadLrcFile?: boolean): Promise<string> => {
  return Promise.resolve('')
}
