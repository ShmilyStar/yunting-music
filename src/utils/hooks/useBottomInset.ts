import { Platform } from 'react-native'
import { getIsTabletLayout } from '@/utils/pixelRatio'
import { useIsTabletLayout } from '@/utils/hooks/useIsTabletLayout'

/**
 * 底部安全区高度（dp）。
 *
 * 参考实现里由安全区探针给出；本工程没有引入 safe-area 依赖：
 * - Android：底部栏占位交给系统导航栏，应用按设计值贴底（0）
 * - iPhone：为 Home Indicator 留 34
 * - iPad：Home Indicator 更矮，留 20（顺便兼顾 iPad 的分辨率档位）
 *
 * 用实时的平板判据：折叠屏展开 / 旋转后要跟着变（`getIsTabletLayout()` 只是
 * 兜底，`useIsTabletLayout()` 才是随窗口走的那个）。
 */
export default () => {
  const isTablet = useIsTabletLayout()
  if (Platform.OS !== 'ios') return 0
  return isTablet || getIsTabletLayout() ? 20 : 34
}
