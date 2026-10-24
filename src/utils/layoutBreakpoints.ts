/**
 * 屏幕档位判据（唯一来源）。
 *
 * 之前两处各写一份（`utils/pixelRatio.ts` 与 `utils/hooks/useIsTabletLayout.ts`），
 * 改一处漏一处就会出现「样式按平板算、列数按手机算」的错位。这里只放纯函数、
 * 不引任何依赖，两个地方都用它。
 *
 * 规则：
 * - **横屏**：宽 ≥ 700dp 且长宽比 < 2.0 视为平板横屏（1280×720 / 1600×900 /
 *   1920×1080 这类低分辨率平板换算成 dp 后最短边不足 600，但布局上仍要宽版）。
 * - **竖屏**：最短边 ≥ 600dp **且** 长宽比 < 1.7 才算平板。
 *   竖屏 16:9（长宽比 1.78）的大屏手机（如 2160×3840@560 → 617×1097dp）
 *   在这条判据下走手机档；平板的竖屏是 4:3 / 16:10（1.33 / 1.6），不受影响。
 */
export const TABLET_MIN_SIDE = 600
/** 竖屏平板的最高长宽比：再瘦就按手机处理 */
export const TABLET_PORTRAIT_MAX_RATIO = 1.7
/** 横屏平板的最小宽度 */
export const TABLET_LANDSCAPE_MIN_WIDTH = 700
/** 横屏平板的最大长宽比 */
export const TABLET_LANDSCAPE_MAX_RATIO = 2.0

export const isTabletLayout = (width: number, height: number): boolean => {
  if (!(width > 0) || !(height > 0)) return false
  const min = Math.min(width, height)
  const max = Math.max(width, height)
  const ratio = max / min
  if (width > height) {
    return max >= TABLET_LANDSCAPE_MIN_WIDTH && ratio < TABLET_LANDSCAPE_MAX_RATIO
  }
  return min >= TABLET_MIN_SIDE && ratio < TABLET_PORTRAIT_MAX_RATIO
}
