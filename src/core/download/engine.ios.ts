import RNFS from 'react-native-fs'
import { mkdir, stat, unlink } from '@/utils/fs'
import { resolveDownloadPath } from './path'
import { ensureDownloadDirs } from './ensureDir'
import { log } from '@/utils/log'
import type { DownloadEngine, EngineLiveEvent, EngineTask } from './engine'

/**
 * iOS 下载引擎：**只用 `react-native-fs`（`NSURLSession` 直连），不再走原生
 * `DownloadModule`**。
 *
 * 为什么放弃原生链路（三轮真机反馈的结论）：
 * 1. 原生把落点拼在 `Documents` 下，还要求路径必须落在 `Documents/Download/`
 *    之内，否则回 `ORPHAN` —— 任何口径偏差都会变成「点下载没反应」；
 * 2. `[NSURL URLWithString:]` 对音源返回的未编码链接会直接返回 nil；
 * 3. 原生任务的错误只回错误码，用户侧看不到是 HTTP 403 还是写盘失败。
 *
 * RNFS 直接写**绝对路径**、无白名单、无二次拼接，失败原因（HTTP 状态码 /
 * 写盘异常）都能原样带回 JS。代价是失去后台续传，但对「下载歌曲到本地」
 * 这个场景完全够用，且行为可预期远比后台续传重要。
 *
 * 导出面必须与 `engine.ts` 完全一致：Metro 在 iOS 上把
 * `@/core/download/engine` 解析到本文件，少导出即丢符号。
 */

/** 浏览器 UA：部分音源 CDN 对缺省 UA（CFNetwork/xxx）会直接 403 */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

interface RunningJob {
  stop: () => void
  targetPath: string
  /** 是否收到过进度：用于「20 秒没有任何字节」的卡死判定 */
  progressed: boolean
}

const running = new Map<string, RunningJob>()
const listeners = new Set<(event: EngineLiveEvent) => void>()
const paused = new Set<string>()
/** taskId → 目标绝对路径：任务结束后仍留一份，供 cancel 清理半截文件 */
const targets = new Map<string, string>()

const emit = (event: EngineLiveEvent) => {
  for (const listener of [...listeners]) listener(event)
}

/** 从 URL 里取 `<协议>//<主机>/` 当 Referer：防盗链的 CDN 常见要求 */
const originOf = (url: string): string | null => {
  const match = /^(https?:\/\/[^/]+)\//i.exec(url)
  return match ? match[1] + '/' : null
}

/** 链接里带空格 / 中文时先做百分号编码，否则 NSURL 直接拒绝 */
const normalizeUrl = (raw: string): string => {
  const url = (raw ?? '').trim()
  if (!url) return ''
  // 已经全是合法字符时原样返回（避免把已编码的 %2F 再编一次）
  if (/^https?:\/\/[^\s\u4e00-\u9fa5]+$/i.test(url)) return url
  try {
    return encodeURI(url)
  } catch {
    return url
  }
}

/**
 * 真正的下载：一个任务一个 RNFS job。
 *
 * `retried` 用于 403/401 时带 Referer 重试一次——部分音源对首请求校验来源。
 */
const runJob = async(task: EngineTask, targetPath: string, headers: Record<string, string>, retried: boolean): Promise<void> => {
  emit({ type: 'start', data: { taskId: task.taskId } })
  const job = RNFS.downloadFile({
    fromUrl: task.url,
    toFile: targetPath,
    headers,
    progressInterval: 500,
    progressDivider: 2,
    progress: (res) => {
      const entry = running.get(task.taskId)
      if (entry) entry.progressed = true
      emit({
        type: 'progress',
        data: {
          taskId: task.taskId,
          downloaded: res.bytesWritten,
          total: res.contentLength > 0 ? res.contentLength : undefined,
        },
      })
    },
  })

  running.set(task.taskId, {
    stop: () => { (job as { stop?: () => void }).stop?.() },
    targetPath,
    progressed: false,
  })

  // 20 秒内一个字节都没动：把地址和状态写进日志，真机排查时不至于瞎猜
  const stallTimer = setTimeout(() => {
    const entry = running.get(task.taskId)
    if (entry && !entry.progressed && !paused.has(task.taskId)) {
      log.warn(`[download] 20s 无进度 task=${task.taskId} url=${task.url} target=${targetPath}`)
    }
  }, 20000)

  let statusCode = 0
  try {
    const result = await job.promise
    statusCode = Number(result.statusCode) || 0
  } catch (err) {
    clearTimeout(stallTimer)
    running.delete(task.taskId)
    // 用户主动暂停/取消：不算错误
    if (paused.has(task.taskId)) {
      paused.delete(task.taskId)
      emit({ type: 'error', data: { taskId: task.taskId, code: 'CANCELLED', hasResumeData: false } })
      return
    }
    const message = (err as Error)?.message ?? 'download failed'
    log.warn(`[download] RNFS 失败 task=${task.taskId} status=${statusCode} ${message}`)
    emit({
      type: 'error',
      data: {
        taskId: task.taskId,
        code: /ENOSPC|no space/i.test(message) ? 'NO_SPACE' : /timed? ?out/i.test(message) ? 'TIMEOUT' : 'WRITE_FAILED',
        message,
        hasResumeData: false,
      },
    })
    return
  }
  clearTimeout(stallTimer)
  running.delete(task.taskId)
  if (paused.has(task.taskId)) {
    paused.delete(task.taskId)
    emit({ type: 'error', data: { taskId: task.taskId, code: 'CANCELLED', hasResumeData: false } })
    return
  }

  // 非 2xx：403/401 带 Referer 再来一次，其它直接报 HTTP 状态码
  if (statusCode < 200 || statusCode >= 300) {
    const origin = originOf(task.url)
    if (!retried && (statusCode === 401 || statusCode === 403) && origin) {
      log.info(`[download] HTTP ${statusCode}，带 Referer 重试一次：${origin}`)
      await unlink(targetPath).catch(() => {})
      await runJob(task, targetPath, { ...headers, Referer: origin, Origin: origin.replace(/\/$/, '') }, true)
      return
    }
    log.warn(`[download] HTTP ${statusCode} task=${task.taskId} url=${task.url}`)
    await unlink(targetPath).catch(() => {})
    emit({
      type: 'error',
      data: {
        taskId: task.taskId,
        code: `HTTP_${statusCode}` as LX.Download.DownloadErrorCode,
        httpStatus: statusCode,
        hasResumeData: false,
      },
    })
    return
  }

  // 落盘校验：HTTP 200 但文件是空的（错误页 / 0 字节）同样按失败处理，
  // 否则用户会看到「已完成」却放不出声音
  const fileStat = await stat(targetPath).catch(() => null)
  const size = Number(fileStat?.size) || 0
  if (size <= 0) {
    log.warn(`[download] 下载完成但文件为空 task=${task.taskId} path=${targetPath}`)
    await unlink(targetPath).catch(() => {})
    emit({
      type: 'error',
      data: { taskId: task.taskId, code: 'FILE_MISSING', message: 'empty file', hasResumeData: false },
    })
    return
  }
  log.info(`[download] 完成 task=${task.taskId} ${size} 字节 -> ${targetPath}`)
  emit({ type: 'complete', data: { taskId: task.taskId, path: targetPath, size } })
}

export const downloadEngine: DownloadEngine = {
  subscribe: (listener: (event: EngineLiveEvent) => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  /** 原生引擎的会话配置项，RNFS 实现里没有对应概念 */
  configure: async() => {},
  start: async(task: EngineTask) => {
    const url = normalizeUrl(task.url)
    if (!url) {
      emit({ type: 'error', data: { taskId: task.taskId, code: 'URL_FAILED', message: 'empty url', hasResumeData: false } })
      return
    }
    // 父目录必须先存在：RNFS 只写文件、不会创建目录，缺目录必然写盘失败
    try {
      await ensureDownloadDirs()
    } catch (err) {
      emit({
        type: 'error',
        data: {
          taskId: task.taskId,
          code: 'WRITE_FAILED',
          message: (err as Error)?.message ?? 'ensure dir failed',
          hasResumeData: false,
        },
      })
      return
    }

    const targetPath = resolveDownloadPath(task.targetPath)
    // RNFS 只写文件、不建父目录；「按歌单分目录」时目标目录可能还不存在
    // （`ensureDownloadDirs` 只建到 music/ 一层），不补建就是 ENOENT
    const targetDir = targetPath.slice(0, targetPath.lastIndexOf('/'))
    if (targetDir) await mkdir(targetDir).catch(() => {})
    log.info(`[download] 开始 task=${task.taskId} -> ${targetPath}`)
    targets.set(task.taskId, targetPath)
    // 同一任务重复 start：先停掉旧的，避免两条传输写同一个文件
    running.get(task.taskId)?.stop()
    running.delete(task.taskId)
    paused.delete(task.taskId)
    // 旧文件先删掉：RNFS 会在已有文件后面续写，留下半截旧数据会拼坏新歌
    await unlink(targetPath).catch(() => {})
    await runJob(
      { ...task, url },
      targetPath,
      { ...DEFAULT_HEADERS, ...(task.headers ?? {}) },
      false,
    )
  },
  pause: async(taskId: string) => {
    const job = running.get(taskId)
    if (!job) return { hasResumeData: false }
    paused.add(taskId)
    job.stop()
    running.delete(taskId)
    return { hasResumeData: false }
  },
  resume: async(taskId: string, _allowsCellular: boolean) => {
    // 调度器在 resume 之后会重新下发 start（RNFS 不支持断点续传，
    // 从 0 开始比拼一个可能的坏文件更可靠）
    paused.delete(taskId)
    return false
  },
  cancel: async(taskId: string, removeResumeData: boolean) => {
    const job = running.get(taskId)
    // 记下目标路径，取消时才能删掉半截文件（不删的话下次下载会拼在旧数据后面）
    const targetPath = job?.targetPath ?? targets.get(taskId)
    if (job) {
      paused.add(taskId)
      job.stop()
      running.delete(taskId)
    }
    if (removeResumeData && targetPath) {
      await unlink(targetPath).catch(() => {})
      targets.delete(taskId)
    }
  },
  removeResumeData: async() => {},
  /** 与 Android 一致：进程内传输没有「重启后可恢复」的会话任务 */
  getActiveTasks: async() => [],
  drainEvents: async() => [],
  ack: async() => {},
  listOrphanTaskIds: async() => [],
  claimOrphan: async() => false,
  removeOrphan: async() => {},
}

export { isDownloadSupported } from './support'

export type { DownloadEngine, EngineLiveEvent, EngineTask }
export type { DownloadEngine as DownloadEngineType }
