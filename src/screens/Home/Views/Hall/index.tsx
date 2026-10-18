import { memo, useCallback, useMemo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { HALL_CATEGORIES } from '@/config/homeTabs'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useWindowSize } from '@/utils/hooks'
import { useI18n } from '@/lang'
import { navigateTo } from '@/core/common'

/** 音乐馆：六宫格分类入口，列数与图标尺寸随屏宽自适应 */
export default memo(() => {
  const t = useI18n()
  const windowSize = useWindowSize()

  const layout = useMemo(() => {
    const width = windowSize.width
    let columns = 2
    if (width >= 1200) columns = 5
    else if (width >= 900) columns = 4
    else if (width >= 680) columns = 3
    const cardWidth = width / columns - scaleSizeW(19)
    const iconSize = Math.max(20, Math.min(40, Math.round(cardWidth * 0.16)))
    const iconWrap = Math.round(iconSize * 1.36) + 2
    const labelSize = iconSize >= 30 ? 16 : 14
    return { columns, cardWidth, iconSize, iconWrap, labelSize }
  }, [windowSize.width])

  const handlePress = useCallback((page: string) => {
    navigateTo(page as Parameters<typeof navigateTo>[0])
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {HALL_CATEGORIES.map(item => {
          const accent = REF_ACCENT[item.accent]
          return (
            <View key={item.id} style={{ width: layout.cardWidth, marginBottom: 10 }} >
              <TouchableOpacity
                style={{ ...styles.card, marginHorizontal: scaleSizeW(5) }}
                activeOpacity={0.7}
                onPress={() => { handlePress(item.page) }}
              >
                <View style={{
                  ...styles.iconWrap,
                  width: layout.iconWrap,
                  height: layout.iconWrap,
                  borderRadius: scaleSizeW(layout.iconWrap / 2),
                  backgroundColor: accent.bg,
                }}>
                  <IconMC name={item.icon} size={layout.iconSize} color={accent.color} />
                </View>
                <Text
                  size={layout.labelSize}
                  color={REF_COLOR.text}
                  style={styles.label}
                  numberOfLines={1}
                >{t(item.labelKey)}</Text>
              </TouchableOpacity>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 4,
    paddingHorizontal: 9,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: REF_COLOR.cardBg,
    borderRadius: 14,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
})
