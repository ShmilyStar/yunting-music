import { readFileHead, rename } from '@/utils/fs'
import { log } from '@/utils/log'
import { resolveDownloadPath } from './path'

/**
 * 下载产物扩展名纠正。
 *
 * 音质档位到扩展名的映射是「猜」的（`getExt`：128k/192k/320k → mp3），
 * 而音乐源给的流不一定是那个容器：实测有音源在 128k 档位返回的是 MP4 容器
 * （文件头 `ftyp mp42`），落在 `.mp3` 上。后果有两个：
 * - 播放器大多能按内容放，但**按扩展名**交给元数据解析器（本地扫描）会失败；
 * - 用户看到的后缀是错的。
 *
 * 这里在下载完成后读一下文件头，按真实容器改名并同步 `metadata`。
 */

/** 文件头 → 真实容器；认不出来返回 null（不动） */
const detectExt = (head: string): LX.Download.FileExt | null => {
  if (head.length < 8) return null
  // MP4 / M4A：第 5~8 字节是 'ftyp'
  if (head.substring(4, 8) === 'ftyp') return 'm4a'
  if (head.startsWith('ID3')) return 'mp3'
  if (head.startsWith('fLaC')) return 'flac'
  if (head.startsWith('OggS')) return 'ogg'
  if (head.startsWith('RIFF')) return 'wav'
  // 无 ID3 标签的裸 MPEG 帧：11 位同步字全 1
  const b0 = head.charCodeAt(0)
  const b1 = head.charCodeAt(1)
  if (b0 === 0xFF && (b1 & 0xE0) === 0xE0) return 'mp3'
  return null
}

/**
 * 纠正单个已完成任务的扩展名。
 *
 * 返回是否改过（调用方据此更新下载索引）。
 */
export const fixDownloadContainerExt = async(downloadInfo: LX.Download.ListItem): Promise<boolean> => {
  const { fileName, ext } = downloadInfo.metadata
  if (!fileName) return false
  const absPath = resolveDownloadPath(downloadInfo.metadata.filePath)
  let head: string
  try {
    head = await readFileHead(absPath, 16)
  } catch (err: any) {
    // 读不到头（权限 / 文件被移走）就保持原样，交给对账逻辑处理
    log.warn('read download head failed: ' + (err?.message ?? err))
    return false
  }
  const realExt = detectExt(head)
  if (!realExt || realExt == ext) return false

  const index = fileName.lastIndexOf('.')
  const newFileName = index > 0
    ? `${fileName.substring(0, index)}.${realExt}`
    : `${fileName}.${realExt}`
  try {
    // `rename(path, name)` 是「同目录内改名」
    await rename(absPath, newFileName)
  } catch (err: any) {
    log.warn('rename download file failed: ' + (err?.message ?? err))
    return false
  }
  downloadInfo.metadata.ext = realExt
  downloadInfo.metadata.fileName = newFileName
  downloadInfo.metadata.filePath = downloadInfo.metadata.filePath.substring(
    0,
    downloadInfo.metadata.filePath.length - fileName.length,
  ) + newFileName
  return true
}
