import { useMemo } from 'react'
import { useWindowSize } from '@/utils/hooks'

/**
 * 实时平板判定：最短边 dp >= 600 **且** 长宽比 < 1.9。
 *
 * `pixelRatio.isTabletLayout` 是**启动时**算出来的常量（缩放体系的历史设计），
 * 旋转屏幕或运行中改窗口尺寸都不会变。凡是「按档位切组件/切列数」这种
 * 需要跟着窗口变化的地方，都用这个 hook，不要用那个常量。
 *
 * 比例条件用于排除 600×1332dp 这类长条大屏手机：它们按最短边会落进平板档，
 * 但平板档的缩放更收敛，标题栏、正文会明显偏小。
 */
export const useIsTabletLayout = () => {
  const { width, height } = useWindowSize()
  return useMemo(() => {
    const min = Math.min(width, height)
    const max = Math.max(width, height)
    return min >= 600 && max / min < 1.9
  }, [width, height])
}
