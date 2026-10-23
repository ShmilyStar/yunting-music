/**
 * 「本地歌曲」是否正在扫描 / 读盘。
 *
 * 标题栏右侧的扫描按钮在「我的」页里（`LocalMusicHeaderBtn`），
 * 真正读盘的逻辑在页面里（`LocalMusic`）——两者隔了两层组件，
 * 用一个最小的订阅式布尔量传递，避免把状态一层层往下塞 props。
 *
 * 与 `utils/topBarInset.ts` 同一种写法：模块级值 + `useSyncExternalStore`。
 */
import { useSyncExternalStore } from 'react'

let scanning = false
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of [...listeners]) listener()
}

/** 页面在开始 / 结束读盘时调用 */
export const setLocalMusicScanning = (next: boolean) => {
  if (next === scanning) return
  scanning = next
  notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const getSnapshot = () => scanning

/** 标题栏按钮据此在「扫描图标」与「转圈」之间切换 */
export const useLocalMusicScanning = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
