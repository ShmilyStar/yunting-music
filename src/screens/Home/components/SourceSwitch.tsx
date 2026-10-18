import { memo } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { REF_ACCENT } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { useIsTabletLayout } from '@/utils/hooks'
import { setSpText } from '@/utils/pixelRatio'

export interface SourceSwitchProps {
  sources: readonly LX.OnlineSource[]
  active: LX.OnlineSource
  onSelect: (source: LX.OnlineSource) => void
  /**
   * `inline`（默认，发现页）：与标题同排，胶囊**靠左**、拉伸铺满标题与「更多」之间的横栏；
   * `block`（排行榜页）：独占一行，两端留白对称，胶囊拉伸铺满整行。
   * 两种都是等宽拉伸，不做居中成组。
   */
  variant?: 'inline' | 'block'
}

/** 胶囊几何（手机档固定 dp；平板档高度跟分组标题走，见下） */
const PILL_HEIGHT = 21
/**
 * 最小宽度压到 28：手机档五个短名加起来
 * `5×28 + 4×5 = 160dp`，窄屏（320dp 档）也能全部显示、不被裁切
 */
const PILL_MIN_W = 28
/** 胶囊之间的固定间隙 */
const PILL_GAP = 5
/**
 * 胶囊内字号（设计值，经 `Text` 的分辨率缩放体系）。
 *
 * 用户反馈某些分辨率下太小：手机档 11 → 13，平板档比例 0.52 → 0.58。
 * 胶囊几何（高 21 / 最小宽 28）保持不变，只放大字。
 */
const PILL_FONT = 13

/** 分组标题的字号（SectionHeader 用的是 `Text size={17}`），胶囊高度按它对齐 */
const TITLE_FONT_SIZE = 17

/** 音源切换胶囊组：选中实心主色、未选中浅绿底 */
export const SourceSwitch = memo(({ sources, active, onSelect, variant = 'inline' }: SourceSwitchProps) => {
  const theme = useTheme()
  const t = useI18n()
  const nameType = useSettingValue('common.sourceNameType')
  const isTablet = useIsTabletLayout()

  /**
   * 平板档：胶囊太扁会和大一档的分组标题不协调，所以高度按**标题字号**（同一套文字缩放）
   * 算出来，内文字号再按高度等比放大 —— 标题字号一变（比如用户调了字体大小），胶囊跟着变。
   */
  const titleFontSize = setSpText(TITLE_FONT_SIZE)
  const pillHeight = isTablet ? Math.max(24, Math.round(titleFontSize * 1.2)) : PILL_HEIGHT
  const pillFont = isTablet ? Math.max(14, Math.round(pillHeight * 0.58)) : PILL_FONT
  const pillMinWidth = isTablet ? Math.max(44, Math.round(pillHeight * 1.8)) : PILL_MIN_W

  return (
    <ScrollView
      horizontal
      // 五个源必须一行全部显示：关掉滚动，避免极端窄屏下最后一个被裁掉
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={variant == 'block' ? styles.containerBlock : styles.containerInline}
    >
      {sources.map((source, index) => {
        const isActive = source == active
        return (
          <TouchableOpacity
            key={source}
            activeOpacity={0.7}
            // 等宽拉伸：五个短名把可用的横栏铺满，宽度一致、间隙一致
            style={{
              height: pillHeight,
              minWidth: pillMinWidth,
              flexGrow: 1,
              flexShrink: 1,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: index == sources.length - 1 ? 0 : PILL_GAP,
              borderRadius: pillHeight / 2,
              backgroundColor: isActive ? theme['c-primary'] : REF_ACCENT.green.bg,
            }}
            onPress={() => { if (!isActive) onSelect(source) }}
          >
            <Text size={pillFont} color={isActive ? '#FFFFFF' : REF_ACCENT.green.color} numberOfLines={1}>
              {t(`source_${nameType}_${source}` as Parameters<typeof t>[0])}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
})

const styles = createStyle({
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  // 与标题同排：整组在标题与「更多」之间铺满（两端留白对称，看起来居中）
  containerInline: {
    flexGrow: 1,
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
  },
  // 独占一行：整行铺满
  containerBlock: {
    flexGrow: 1,
    alignItems: 'center',
  },
})

export default SourceSwitch
