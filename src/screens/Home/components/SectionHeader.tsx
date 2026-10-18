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
}

/** 区块标题：4×17 主色竖条 + 17 号标题 + 右侧插槽 + 「更多」 */
export const SectionHeader = memo(({ title, right, showMore, onMore, moreText }: SectionHeaderProps) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={styles.container}>
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

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    paddingTop: 16,
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
