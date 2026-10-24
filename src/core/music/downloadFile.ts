import { getMusicUrl } from '@/core/music'
import { resolveDownloadPath } from '@/core/download/path'
import { ensureDownloadDirs } from '@/core/download/ensureDir'
import { downloadFile } from '@/utils/fs'
import { filterFileName } from '@/utils/common'
import { formatMusicName } from '@/utils/tools'
import settingState from '@/store/setting/state'

/** 取 URL 的扩展名，取不到时回退 mp3 */
const extOf = (url: string) => {
  const clean = url.split('?')[0]
  const at = clean.lastIndexOf('.')
  const ext = at > -1 ? clean.slice(at + 1).toLowerCase() : ''
  return /^(mp3|flac|m4a|aac|wav|ape|ogg|mp4)$/.test(ext) ? ext : 'mp3'
}

/**
 * 直接下载当前歌曲到用户可见的下载目录。
 *
 * - Android：`<外部存储或应用专属目录>/Download/yuntingmusic/music/`
 * - iOS：`<Documents>/Download/Music/`（「文件」App 可见）
 *
 * 与「下载管理」那套任务引擎不同：这里是一次性直下，供播放页的下载按钮使用。
 *
 * @param musicInfo 要下载的歌曲
 * @param onProgress 进度回调（0~1）
 * @param quality 本次下载指定的音质；不传用播放音质设置（批量下载让用户先选音质）
 * @returns 落盘后的绝对路径
 * @throws 源不支持下载（本地歌曲）或取流/写盘失败
 */
export const downloadMusic = async({
  musicInfo,
  onProgress,
  quality,
}: {
  musicInfo: LX.Music.MusicInfo
  onProgress?: (progress: number) => void
  quality?: LX.Quality
}): Promise<string> => {
  if (musicInfo.source === 'local') throw new Error('DOWNLOAD_UNSUPPORTED_SOURCE')

  const url = await getMusicUrl({
    musicInfo,
    quality: quality ?? settingState.setting['player.playQuality'],
    isRefresh: false,
  })
  if (!url) throw new Error('DOWNLOAD_NO_URL')

  const fileName = `${filterFileName(formatMusicName(
    settingState.setting['download.fileName'],
    musicInfo.name,
    musicInfo.singer,
  ))}.${extOf(url) || 'mp3'}`

  // 目录必须先建好：RNFS.downloadFile 不会创建父目录，缺目录即写盘失败
  await ensureDownloadDirs()

  const path = resolveDownloadPath(fileName)

  const { promise } = downloadFile(url, path, {
    progressInterval: 200,
    progress: ({ contentLength, bytesWritten }) => {
      if (!onProgress) return
      onProgress(contentLength > 0 ? Math.min(1, bytesWritten / contentLength) : 0)
    },
  })
  const result = await promise
  if (result.statusCode && (result.statusCode < 200 || result.statusCode >= 300)) {
    throw new Error(`DOWNLOAD_HTTP_${result.statusCode}`)
  }
  onProgress?.(1)
  return path
}
