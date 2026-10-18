import { getMusicUrl } from '@/core/music'
import { resolveDownloadPath } from '@/core/download/path'
import { downloadFile } from '@/utils/fs'
import { filterFileName } from '@/utils/common'
import { formatMusicName } from '@/utils/tools'
import settingState from '@/store/setting/state'

const DOWNLOAD_DIR = '云听音乐'

/** 取 URL 的扩展名，取不到时回退 mp3 */
const extOf = (url: string) => {
  const clean = url.split('?')[0]
  const at = clean.lastIndexOf('.')
  const ext = at > -1 ? clean.slice(at + 1).toLowerCase() : ''
  return /^(mp3|flac|m4a|aac|wav|ape|ogg|mp4)$/.test(ext) ? ext : 'mp3'
}

/**
 * 直接下载当前歌曲到应用私有目录（`Documents/云听音乐/`）。
 *
 * 与「下载管理」那套任务引擎不同：这里是一次性直下，供播放页的下载按钮使用；
 * 参考实现同样把下载入口简化成一次直下 + 路径提示。
 *
 * @param musicInfo 要下载的歌曲
 * @param onProgress 进度回调（0~1）
 * @returns 落盘后的绝对路径
 * @throws 源不支持下载（本地歌曲）或取流/写盘失败
 */
export const downloadMusic = async({
  musicInfo,
  onProgress,
}: {
  musicInfo: LX.Music.MusicInfo
  onProgress?: (progress: number) => void
}): Promise<string> => {
  if (musicInfo.source === 'local') throw new Error('DOWNLOAD_UNSUPPORTED_SOURCE')

  const url = await getMusicUrl({
    musicInfo,
    quality: settingState.setting['player.playQuality'],
    isRefresh: false,
  })

  const fileName = `${filterFileName(formatMusicName(
    settingState.setting['download.fileName'],
    musicInfo.name,
    musicInfo.singer,
  ))}.${extOf(url) || 'mp3'}`

  const path = resolveDownloadPath(`${DOWNLOAD_DIR}/${fileName}`)

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
