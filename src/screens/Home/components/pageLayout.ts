import { useMemo } from 'react'
import { computeIsTabletLayout, useWindowSize, useIsWideContent } from '@/utils/hooks'

/** 平板内容区左右留白：不顶边，也不把内容缩成手机窄条 */
const TABLET_PADDING_MIN = 16
const TABLET_PADDING_MAX = 40
/** 平板留白按屏宽比例增长，夹在上述区间内 */
const TABLET_PADDING_RATIO = 0.03

/** 长条大屏手机（非平板）的内容上限：一行 4 张卡片仍然可读，又不会铺成一条 */
const WIDE_PHONE_CONTENT_WIDTH = 600

export interface PageLayout {
  /** 内容区定宽；`undefined` 表示铺满可用宽度 */
  width?: number
  /** 内容区实际可用宽度（已扣除留白，dp） */
  contentWidth: number
  /** 可用宽度超过阈值（平板与长条大屏手机都算） */
  isWide: boolean
  /** 是否平板档 */
  isTablet: boolean
  /** 是否「平板横屏」（宽度大于高度） */
  isTabletLandscape: boolean
  /** 内容区左右内边距（dp） */
  padding: number
}

/**
 * 页面布局参数。
 *
 * 三档：
 * - **手机**：铺满；
 * - **平板竖屏**：铺满全宽，只留左右边距；靠 4 列网格把内容铺开，
 *   字号与控件与手机同尺寸（不再等比放大）；
 * - **平板横屏**：同上，卡片按宽度排到 8 列。
 *
 * 只有「宽但不是平板」的长条大屏手机才把内容收进 600dp 居中。
 */
export const usePageLayout = (windowWidth: number): PageLayout => {
  const { height } = useWindowSize()
  const isTablet = useMemo(() => computeIsTabletLayout(windowWidth, height), [height, windowWidth])
  const isTabletLandscape = isTablet && windowWidth > height
  const isWideContent = useIsWideContent(windowWidth)

  return useMemo(() => {
    if (isTablet) {
      // 平板：铺满全宽；留白随屏宽增长，最大 40dp
      const padding = Math.round(Math.min(
        TABLET_PADDING_MAX,
        Math.max(TABLET_PADDING_MIN, windowWidth * TABLET_PADDING_RATIO),
      ))
      return {
        width: undefined,
        contentWidth: windowWidth - padding * 2,
        isWide: true,
        isTablet,
        isTabletLandscape,
        padding,
      }
    }

    // 手机：铺满；长条大屏手机收进 600dp 居中
    const width = isWideContent ? WIDE_PHONE_CONTENT_WIDTH : undefined
    return {
      width,
      contentWidth: width ?? windowWidth,
      isWide: isWideContent,
      isTablet,
      isTabletLandscape,
      padding: 0,
    }
  }, [isTablet, isTabletLandscape, isWideContent, windowWidth])
}
