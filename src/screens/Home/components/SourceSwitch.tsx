import { memo } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { REF_ACCENT } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { useIsTabletLayout } from '@/utils/hooks'
import { setSpText, scaleSizeW } from '@/utils/pixelRatio'

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

/** 胶囊几何（设计值，统一经 `scaleSizeH/W` / `setSpText` 换算） */
/** 胶囊文字相对胶囊高度的期望比例（高于它说明胶囊太扁、字会被裁） */
const PILL_TEXT_FIT_RATIO = 1.55
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
 */
const PILL_FONT = 13

/** 音源切换胶囊组：选中实心主色、未选中浅绿底 */
export const SourceSwitch = memo(({ sources, active, onSelect, variant = 'inline' }: SourceSwitchProps) => {
  const theme = useTheme()
  const t = useI18n()
  const nameType = useSettingValue('common.sourceNameType')
  const isTablet = useIsTabletLayout()

  /**
   * 几何全部改成**跟随文字缩放**。
   *
   * 以前高度写死 21dp，而里面 `<Text size={13}>` 会按 dp 倍率放大
   * （2160×3840@560 上约 1.6 倍）：胶囊高仍是 21dp、字却涨到 20dp+，
   * 结果 KG/QQ/WY 被上下裁掉一半（用户 2026-10-21 反馈「胶囊内字体显示不完整」）。
   *
   * 现在高度、最小宽度、字号出自同一个倍率：
   * - 高度按**实际渲染出来的字号**算（`setSpText` 已含 dp 倍率与「字体大小」设置）；
   * - 平板的放大系数再乘在它上面，保持原来「平板胶囊更胖」的比例。
   */
  const pillFontSize = setSpText(PILL_FONT)
  /** 行高 = 字号 × 1.55（上下各留 0.275 字身的余量），再给平板加一点 */
  const pillHeight = Math.max(
    18,
    Math.round(pillFontSize * (isTablet ? PILL_TEXT_FIT_RATIO + 0.2 : PILL_TEXT_FIT_RATIO)),
  )
  const pillFont = isTablet ? Math.max(14, Math.round(pillHeight * 0.58)) : PILL_FONT
  const pillMinWidth = isTablet
    ? Math.max(44, Math.round(pillHeight * 1.8))
    : Math.max(scaleSizeW(PILL_MIN_W), Math.round(pillFontSize * 1.6))

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
              // 文字比胶囊多留一点纵向余量，避免圆角/升部被裁
              paddingHorizontal: scaleSizeW(2),
              marginRight: index == sources.length - 1 ? 0 : scaleSizeW(PILL_GAP),
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
