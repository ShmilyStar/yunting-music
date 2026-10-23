/**
 * 下载引擎接口 + Android 实现。
 *
 * - 接口（`EngineLiveEvent` / `DownloadEngine`）是两端冻结的契约（D10），
 *   三个文件（本文件、`engine.ios.ts`）的导出面必须一致：
 *   Metro 按平台扩展解析，少导出即丢符号。
 * - iOS 实现见 `engine.ios.ts`（绑定原生 `DownloadModule` 的 `NSURLSession` 后台会话）。
 * - **本文件是 Android 实现**：用 `react-native-fs` 的 `downloadFile` 在应用进程内下载。
 *   与 iOS 的语义差异（scheduler 已把它们当可选能力）：
 *   - `pause` 后没有系统续传数据 → 一律 `hasResumeData: false`，恢复时从 0 重下
 *   - `getActiveTasks` / 孤儿认领返回空（进程内传输，进程结束即失效）
 *   - 事件不落盘，`drainEvents` 返回空（调度器只依赖实时 `subscribe`）
 */

import RNFS, { type DownloadFileOptions, type DownloadResult } from 'react-native-fs'
import { resolveDownloadPath } from './path'

/**
 * 实时事件（`LxDownloadEvent`）。complete / error 同时进事件日志，
 * 可经 `drainEvents` 补领；start / progress 只实时投递
 */
export interface EngineLiveEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'bgFinished'
  data: {
    taskId: string
    seq?: number
    total?: number
    downloaded?: number
    path?: string
    size?: number
    code?: LX.Download.DownloadErrorCode
    httpStatus?: number
    message?: string
    hasResumeData?: boolean
  }
}

export interface EngineTask {
  taskId: string
  url: string
  targetPath: string
  allowsCellular: boolean
  headers?: Record<string, string>
}

export interface DownloadEngine {
  subscribe: (listener: (event: EngineLiveEvent) => void) => () => void
  configure: (opts: { maxConcurrent: number }) => Promise<void>
  start: (task: EngineTask) => Promise<void>
  pause: (taskId: string) => Promise<{ hasResumeData: boolean }>
  resume: (taskId: string, allowsCellular: boolean) => Promise<boolean>
  cancel: (taskId: string, removeResumeData: boolean) => Promise<void>
  removeResumeData: (taskId: string) => Promise<void>
  getActiveTasks: () => Promise<Array<{ taskId: string, state: 'running' | 'suspended', downloaded: number, total: number }>>
  drainEvents: () => Promise<LX.Download.EngineEvent[]>
  ack: (lastSeq: number) => Promise<void>
  // 孤儿认领（修 E）：元信息丢失时的完整下载文件，认领回目标路径或删除
  listOrphanTaskIds: () => Promise<string[]>
  claimOrphan: (taskId: string, destPath: string) => Promise<boolean>
  removeOrphan: (taskId: string) => Promise<void>
}

export { isDownloadSupported } from './support'

/** 运行中的传输：taskId → 停止函数与目标路径 */
const active = new Map<string, { stop: () => void, targetPath: string }>()
const listeners = new Set<(event: EngineLiveEvent) => void>()

const emit = (event: EngineLiveEvent) => {
  for (const listener of [...listeners]) listener(event)
}

/** 下载完成后读文件大小，供 complete 事件使用 */
const readSize = async(path: string) => {
  try {
    const stat = await RNFS.stat(path)
    return Number(stat.size) || 0
  } catch {
    return 0
  }
}

export const downloadEngine: DownloadEngine = {
  subscribe(listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  // 并发数由 JS 调度器控制（scheduler.ts 的 runningTask.size），无需下发
  async configure(_opts: { maxConcurrent: number }) {},

  async start(task: EngineTask) {
    /**
     * 调度器传进来的是**相对 `music/` 的路径**（换设备/容器变化后仍有效），
     * 而 RNFS 的 `toFile` 只认绝对路径：不解析会以相对 CWD 打开文件，
     * 直接 `ENOENT` 落到「文件写入失败」。目录已建好也照样写不进去。
     */
    const targetPath = resolveDownloadPath(task.targetPath)
    // 同一任务重复 start：先停掉旧的，避免两条传输写同一个文件
    active.get(task.taskId)?.stop()

    const option: DownloadFileOptions = {
      fromUrl: task.url,
      toFile: targetPath,
      // 进度事件不要过密：间隔 500ms / 每 5% 一次，减少桥调用
      progressInterval: 500,
      progressDivider: 5,
      headers: task.headers,
      // 蜂窝网络限制由 JS 调度器按设置判断（RNFS 不感知网络类型）
      progress: (res) => {
        emit({
          type: 'progress',
          data: {
            taskId: task.taskId,
            downloaded: res.bytesWritten,
            total: res.contentLength > 0 ? res.contentLength : undefined,
          },
        })
      },
    }

    emit({ type: 'start', data: { taskId: task.taskId } })

    const promise = RNFS.downloadFile(option)
    // RNFS 的停止接口是 `DownloadFileJob`（含 promise 与 stop）
    active.set(task.taskId, {
      stop: () => { (promise as { stop?: () => void }).stop?.() },
      targetPath,
    })

    promise.promise.then(async(result: DownloadResult) => {
      active.delete(task.taskId)
      if (result.statusCode < 200 || result.statusCode >= 300) {
        emit({
          type: 'error',
          data: {
            taskId: task.taskId,
            code: `HTTP_${result.statusCode}` as LX.Download.DownloadErrorCode,
            httpStatus: result.statusCode,
            hasResumeData: false,
          },
        })
        return
      }
      emit({
        type: 'complete',
        data: {
          taskId: task.taskId,
          path: task.targetPath,
          // 文件已下载成功，仅取大小失败时不应把整个任务判为失败：
          // 回落 0，交给上层按实际文件大小校正。
          size: await readSize(targetPath).catch(() => 0),
        },
      })
    }).catch((err: Error) => {
      active.delete(task.taskId)
      emit({
        type: 'error',
        data: {
          taskId: task.taskId,
          code: 'WRITE_FAILED' as LX.Download.DownloadErrorCode,
          message: err?.message ?? 'download failed',
          hasResumeData: false,
        },
      })
    })
  },

  /**
   * 暂停：停掉传输并如实报告「没有续传数据」——
   * 不能假装成功，否则会留下半成品文件且恢复逻辑走错分支。
   */
  async pause(taskId: string) {
    active.get(taskId)?.stop()
    active.delete(taskId)
    return { hasResumeData: false }
  },

  /** 恢复：让调度器重新 start（Android 无续传数据） */
  async resume(taskId: string, _allowsCellular: boolean) {
    return active.has(taskId)
  },

  async cancel(taskId: string, removeResumeData: boolean) {
    const task = active.get(taskId)
    task?.stop()
    active.delete(taskId)
    if (removeResumeData && task?.targetPath) {
      await RNFS.unlink(task.targetPath).catch(() => {})
    }
  },

  async removeResumeData(_taskId: string) {},

  async getActiveTasks() {
    return []
  },

  async drainEvents() {
    return []
  },

  async ack(_lastSeq: number) {},

  async listOrphanTaskIds() {
    return []
  },

  async claimOrphan(_taskId: string, _destPath: string) {
    return false
  },

  async removeOrphan(_taskId: string) {},
}

export type { DownloadEngine as DownloadEngineType }
