import { useMemo } from 'react'
import { useWindowSize } from '@/utils/hooks'
import { isTabletLayout } from '@/utils/layoutBreakpoints'

/** 平板判据：与 `utils/pixelRatio.getIsTabletLayout()` 共用 `layoutBreakpoints` 的同一份规则 */
export const computeIsTabletLayout = (width: number, height: number) => isTabletLayout(width, height)

/** 内容区收窄阈值（dp）：可用宽度超过它就不再铺满，改为收窄居中 */
const WIDE_CONTENT_WIDTH = 600

/**
 * 实时平板判定：最短边 dp >= 600 **且** 长宽比 < 1.9。
 *
 * 判据与 `pixelRatio.getIsTabletLayout()` 一致，差别在**响应式**：
 * 那个是普通函数，运行时窗口变化由 `refreshAllStyles()` → `refreshScale()` 重算，
 * 但不会触发 React 重渲染。所以「按档位切组件 / 切列数」这类需要跟着窗口变化
 * 重新渲染的地方，用这个 hook 取；不要直接调用那个函数。
 *
 * 比例条件把 600×1332dp 这类长条大屏手机排除在外：它们不是平板，
 * 走手机档才不会让标题栏、正文被平板的收敛系数压小。
 */
export const useIsTabletLayout = () => {
  const { width, height } = useWindowSize()
  return useMemo(() => computeIsTabletLayout(width, height), [height, width])
}

/**
 * 内容区是否需要收窄居中。
 *
 * 平板（含横屏）一律收窄；长条大屏手机（判据上不是平板）只要可用宽度超过阈值
 * 也收窄——铺满时内容区接近 600dp，一行 4 张歌单卡片会挤，收窄后卡片回到手机比例。
 */
export const useIsWideContent = (windowWidth?: number) => {
  const { width, height } = useWindowSize()
  const available = windowWidth ?? width
  return useMemo(
    () => computeIsTabletLayout(width, height) || available > WIDE_CONTENT_WIDTH,
    [available, height, width],
  )
}
