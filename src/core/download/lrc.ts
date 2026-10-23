import { writeFile } from '@/utils/fs'
import { buildLyrics } from '@/utils/lrcTools'
import { resolveLrcPath } from './path'
import { getLyricInfo } from '@/core/music/online'
import settingState from '@/store/setting/state'

/**
 * `.lrc` 输出（UTF-8，§歌词文件输出）。
 * 桌面版的 gbk 选项不移植（移动端无车载读盘场景）
 */

/**
 * 任务完成后按设置输出同名 `.lrc`。歌词经 `buildLyrics` 拼装，
 * 按子开关包含扩展歌词 / 翻译 / 罗马音
 */
export const saveLrc = async(downloadInfo: LX.Download.ListItem): Promise<void> => {
  if (!settingState.setting['download.isDownloadLrc']) return
  const musicInfo = downloadInfo.metadata.musicInfo
  const isUseOtherSource = settingState.setting['download.isUseOtherSource']
  const lrcs = await getLyricInfo({
    musicInfo,
    isRefresh: false,
    allowToggleSource: isUseOtherSource,
  }).catch(() => null)
  if (!lrcs?.lyric) return
  const lrc = buildLyrics(
    lrcs,
    settingState.setting['download.isDownloadLxLrc'],
    settingState.setting['download.isDownloadTLrc'],
    settingState.setting['download.isDownloadRLrc'],
  )
  // filePath 是相对 Documents 的路径；同目录同名替换扩展名。
  // 写入必须解析为绝对路径，RNFS 不认相对路径
  const relPath = downloadInfo.metadata.filePath
  if (!relPath) return
  // 歌词统一写到 lrc/ 下：只取文件名（去掉按列表分的子目录），平铺存放
  const fileName = relPath.slice(relPath.lastIndexOf('/') + 1)
  const lrcName = fileName.substring(0, fileName.lastIndexOf('.')) + '.lrc'
  await writeFile(resolveLrcPath(lrcName), lrc, 'utf8')
  downloadInfo.metadata.lrcPath = lrcName
}
