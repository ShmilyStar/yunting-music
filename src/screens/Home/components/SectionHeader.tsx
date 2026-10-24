import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

export interface SectionHeaderProps {
  title: string
  /** 右侧插槽（源胶囊等） */
  right?: ReactNode
  showMore?: boolean
  onMore?: () => void
  moreText?: string
  /** 紧凑行高：平板「一屏放完」的页面用它压掉上下留白 */
  compact?: boolean
}

/** 区块标题：4×17 主色竖条 + 17 号标题 + 右侧插槽 + 「更多」 */
export const SectionHeader = memo(({ title, right, showMore, onMore, moreText, compact }: SectionHeaderProps) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={{ ...styles.bar, backgroundColor: theme['c-primary'] }} />
      <Text style={styles.title} size={17} color={REF_COLOR.text} numberOfLines={1}>{title}</Text>
      {right ? <View style={styles.right}>{right}</View> : <View style={styles.spacer} />}
      {showMore && onMore
        ? (
            <TouchableOpacity style={styles.more} activeOpacity={0.6} onPress={onMore}>
              <Text size={13} color={theme['c-primary']}>{moreText ?? t('more')}</Text>
              <IconMC name="chevron-right" size={16} color={theme['c-primary']} />
            </TouchableOpacity>
          )
        : null}
    </View>
  )
})

/**
 * 分组标题（compact 档）的实测高度基准值。
 *
 * 与 `createStyle` 里的 `containerCompact`（paddingTop 6 + paddingBottom 4）
 * 加上标题行高一起估算；发现页用它做「一屏放完」的几何计算。
 * 需要调整上下留白时，改这里与样式两处保持一致。
 */
export const SECTION_HEADER_COMPACT_BASE = 31

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    paddingTop: 16,
    paddingBottom: 8,
  },
  /**
   * 一屏放完时用的紧凑档。
   *
   * 下边距从 4 加到 8：胶囊/切换条紧贴下方首行封面，字放大后视觉上会「粘」在一起
   * （用户 2026-10-21 反馈）。上边距也加 2，避免与上一行卡片文字挤在一起。
   */
  containerCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  bar: {
    width: 4,
    height: 17,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    flexGrow: 0,
    flexShrink: 0,
  },
  spacer: {
    flexGrow: 1,
    flexShrink: 0,
  },
  right: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  more: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingVertical: 2,
  },
})

export default SectionHeader
