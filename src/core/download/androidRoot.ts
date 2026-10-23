import { Platform } from 'react-native'
import { readDir, mkdir, moveFile, readFile, writeFile, unlink, existsFile } from '@/utils/fs'
import { hasAllFilesAccess } from '@/utils/nativeModules/utils'
import { log } from '@/utils/log'
import { ensureDownloadDirs, resetDownloadDirsCache } from './ensureDir'
import {
  downloadLrcDirPath,
  downloadMusicDirPath,
  downloadRootPath,
  isPublicDownloadRoot,
  setAndroidPublicDownloadEnabled,
} from './path'

/**
 * Android 下载根目录的自愈逻辑（用户 2026-10-22 反馈「下载的歌在系统下载目录里找不到」）。
 *
 * 目标落点：`<外部存储>/Download/yuntingmusic/{music,lrc}`（用户约定的目录布局）。
 * 但 Android 10+ 分区存储下，写公共 Download 需要「所有文件访问」权限；
 * 没有权限时只能落到应用专属目录 `Android/data/<包名>/files/Download/yuntingmusic`。
 *
 * 所以这里在启动 / 回前台时：按权限真实状态切换根目录 → 建目录 →
 * 把旧目录里已经下好的歌**迁移**过去（否则切换后「已下载」会突然变空）。
 */

const SUB_DIRS = ['music', 'lrc'] as const

/** 递归收集目录下的文件（相对路径 + 绝对路径） */
const walkFiles = async(dir: string, prefix = ''): Promise<Array<{ abs: string, rel: string }>> => {
  const out: Array<{ abs: string, rel: string }> = []
  const entries = await readDir(dir).catch(() => [])
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory) {
      out.push(...await walkFiles(entry.path, rel))
    } else if (entry.isFile) {
      out.push({ abs: entry.path, rel })
    }
  }
  return out
}

/**
 * 把旧根目录下已下载的文件搬到新根目录（保持 music/lrc 与子目录结构）。
 *
 * 同分区时 `moveFile` 就是 rename，很快；跨分区失败再退化成
 * 「读 → 写 → 删」（大文件会占用内存，只在异常路径上发生）。
 */
export const migrateDownloadRoot = async(fromRoot: string, toRoot: string): Promise<number> => {
  if (!fromRoot || !toRoot || fromRoot === toRoot) return 0
  let moved = 0
  for (const sub of SUB_DIRS) {
    const fromDir = `${fromRoot}/${sub}`
    if (!await existsFile(fromDir).catch(() => false)) continue
    const files = await walkFiles(fromDir)
    for (const file of files) {
      const dest = `${toRoot}/${sub}/${file.rel}`
      const destDir = dest.slice(0, dest.lastIndexOf('/'))
      try {
        await mkdir(destDir).catch(() => {})
        try {
          await moveFile(file.abs, dest)
        } catch {
          const data = await readFile(file.abs, 'base64')
          await writeFile(dest, data, 'base64')
          await unlink(file.abs).catch(() => {})
        }
        moved++
      } catch (err) {
        log.warn('[download] 迁移已下载文件失败：' + ((err as Error)?.message ?? err))
      }
    }
  }
  return moved
}

/**
 * 启动 / 回前台调用：让下载根目录与「所有文件访问」权限保持一致。
 *
 * - 权限就绪 → 切到公共 Download（并迁移旧文件），用户在任何文件管理器里都能看到；
 * - 没有权限 → 保持应用专属目录（下载照常可用，路径更深）。
 *
 * 返回是否发生了目录切换。
 */
export const syncAndroidDownloadRoot = async(): Promise<boolean> => {
  if (Platform.OS !== 'android') return false
  const granted = await hasAllFilesAccess().catch(() => false)
  const fromRoot = downloadRootPath
  const changed = setAndroidPublicDownloadEnabled(granted)
  if (!changed) {
    // 目录没变也要保证它存在（首次安装 / 用户清理过）
    await ensureDownloadDirs().catch(() => {})
    return false
  }
  // 根目录变了：清掉「已建过目录」的缓存，否则不会重新创建新目录
  resetDownloadDirsCache()
  await ensureDownloadDirs().catch((err: Error) => {
    log.warn('[download] 创建下载目录失败：' + (err?.message ?? err))
  })
  const moved = await migrateDownloadRoot(fromRoot, downloadRootPath).catch(() => 0)
  log.info(
    `[download] 下载目录切换到${isPublicDownloadRoot() ? '公共 Download' : '应用专属目录'}：` +
    `${downloadMusicDirPath}${moved > 0 ? `（迁移 ${moved} 个文件）` : ''}`,
  )
  return true
}

export { downloadMusicDirPath, downloadLrcDirPath }
