import { useEffect, useRef, useState } from 'react'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'

/**
 * 「当前页面最上面那条栏」的下框线位置（px，绝对 y，含状态栏）。
 *
 * 为什么需要它：播放列表弹层是绝对定位的全屏层，上沿必须**正好**贴在这条线上。
 * 之前各处都用 `statusBarHeight + scaleSizeH(HEADER_HEIGHT)` 反算，有两个问题：
 * 1. 取整误差：不同分辨率 / 状态栏高度下会差 1~4px（压住下边框，或露出一条白缝）；
 * 2. 二级页（歌单详情 / 排行榜 / 本地歌曲…）上面还有一条 `SubPageHeader`，
 *    弹层按主标题栏算就会钻到二级页标题栏**下面**，把弹层第一行挡掉。
 *
 * 现在改为「谁画了那条线谁自己上报」：
 * - `MainTabHeader` 上报 `y + height`（贴顶，等于窗口坐标）；
 * - `SubPageHeader` 上报 `主标题栏下沿 + 自己的高度`（它永远排在主标题栏下面）；
 * - 弹层取**所有上报值里的最大值**（= 当前可见的最下面那条线），
 *   二级页不存在时自然退回主标题栏。
 */
export const MAIN_KEY = 'main'

const values = new Map<string, number>()
const listeners = new Set<() => void>()
let snapshot = 0

const recompute = () => {
  let max = 0
  values.forEach(v => { if (v > max) max = v })
  if (max === snapshot) return
  snapshot = max
  listeners.forEach(fn => { fn() })
}

/** 上报某条栏的下沿位置（px）。同一个 key 覆盖上一次的值。 */
export const setTopBarInset = (key: string, value: number) => {
  const next = Math.round(value)
  if (next <= 0 || values.get(key) === next) return
  values.set(key, next)
  recompute()
}

/** 栏卸载时清掉自己的上报（返回上一层后弹层要退回上一条线）。 */
export const clearTopBarInset = (key: string) => {
  if (values.delete(key)) recompute()
}

/** 主标题栏下沿（播放页 / 二级页用它当基准） */
export const getMainTopBarInset = () => values.get(MAIN_KEY) ?? 0

/** 按设计值反算的兜底值（首帧还没测量到、或极早期渲染时用） */
export const fallbackTopBarInset = (statusBarHeight: number) =>
  Math.round(statusBarHeight + scaleSizeH(HEADER_HEIGHT))

const useSubscribe = () => {
  const [, force] = useState(0)
  useEffect(() => subscribeTopBarInset(() => { force(v => v + 1) }), [])
  return snapshot
}

export const subscribeTopBarInset = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/**
 * 当前页面最上面那条栏的下沿：有二级页标题栏时取它，否则取主标题栏。
 * 还没上报过时返回 `fallback`（一般是 `fallbackTopBarInset(statusBarHeight)`）。
 */
export const useTopBarInset = (fallback: number) => {
  const value = useSubscribe()
  return value > 0 ? value : fallback
}

/** 只关心主标题栏下沿（播放页：它自己就画了主标题栏） */
export const useMainTopBarInset = (fallback: number) => {
  useSubscribe()
  const value = getMainTopBarInset()
  return value > 0 ? value : fallback
}

/** 生成一个稳定的上报 key（每次挂载不同，卸载时只清自己那条） */
export const useTopBarInsetKey = (prefix: string) => {
  const ref = useRef<string>('')
  if (!ref.current) ref.current = `${prefix}_${Math.random().toString(36).slice(2)}`
  useEffect(() => () => { clearTopBarInset(ref.current) }, [])
  return ref.current
}
