import { memo, useMemo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import Image from '@/components/common/Image'
import { REF_ACCENT, type RefAccentKey } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useWindowSize } from '@/utils/hooks'

/** 横向滚动模式的卡片宽度（设计值） */
const CARD_WIDTH = 100
/** 横向滚动模式的卡片间距（设计值，参考实现约 9dp） */
const SCROLL_GAP = 9
/** 折行模式的左右留白、卡片间距（设计值） */
const GRID_PADDING = 12
const GRID_GAP = 10
/** 容器宽 ≥ 1000 才允许一行 8 个，否则一律 4 个（发现页 8 个歌单正好两行） */
const GRID_FULL_ROW_WIDTH = 1000
const GRID_WIDE_COLUMNS = 8
const GRID_NARROW_COLUMNS = 4
/** 缩略图里图标占方块边长的比例（与横滑模式 44/104 保持一致） */
const ICON_RATIO = 44 / CARD_WIDTH

export interface CardItem {
  id: string
  name: string
  sub?: string
  pic?: string | null
  accent?: RefAccentKey
  icon?: string
}

export interface CardRowProps {
  data: CardItem[]
  /** scroll：横向滚动；wrap：折行网格 */
  mode?: 'scroll' | 'wrap'
  onPress: (item: CardItem, index: number) => void
}

const Cover = memo(({ item, width }: { item: CardItem, width: number }) => {
  const accent = REF_ACCENT[item.accent ?? 'green']
  return (
    <View style={{
      width,
      aspectRatio: 1,
      borderRadius: 6,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 5,
      elevation: 2,
      backgroundColor: item.pic ? accent.bg : accent.bg,
    }}>
      {item.pic
        ? <Image url={item.pic} style={{ width, height: width }} />
        : (
            <IconMC
              name={item.icon ?? 'music-note'}
              size={Math.round(width * ICON_RATIO)}
              color={accent.color}
            />
          )}
    </View>
  )
})

const Card = memo(({ item, width, onPress }: { item: CardItem, width: number, onPress: () => void }) => (
  <TouchableOpacity style={{ ...styles.card, width }} activeOpacity={0.7} onPress={onPress}>
    <Cover item={item} width={width} />
    <Text size={12} numberOfLines={2} style={styles.name}>{item.name}</Text>
    {item.sub ? <Text size={10} numberOfLines={1} color={REF_ACCENT.green.color} style={styles.sub}>{item.sub}</Text> : null}
  </TouchableOpacity>
))

/** 卡片行：封面 + 名称（+ 副标题），支持横滑与折行两种排版 */
export const CardRow = memo(({ data, mode = 'scroll', onPress }: CardRowProps) => {
  const windowSize = useWindowSize()

  const layout = useMemo(() => {
    const gap = scaleSizeW(GRID_GAP)
    const padding = scaleSizeW(GRID_PADDING)
    const wrapWidth = windowSize.width
    const avail = wrapWidth - padding * 2
    const maxColumns = wrapWidth >= GRID_FULL_ROW_WIDTH ? GRID_WIDE_COLUMNS : GRID_NARROW_COLUMNS
    const columns = Math.max(1, Math.min(maxColumns, data.length || 1))
    const width = Math.floor((avail - gap * (columns - 1)) / columns)
    return { gap, padding, columns, width }
  }, [data.length, windowSize.width])

  if (mode == 'scroll') {
    const gap = scaleSizeW(SCROLL_GAP)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {data.map((item, index) => (
          <View key={item.id} style={{ marginRight: index == data.length - 1 ? 0 : gap }}>
            <Card item={item} width={scaleSizeW(CARD_WIDTH)} onPress={() => { onPress(item, index) }} />
          </View>
        ))}
      </ScrollView>
    )
  }

  return (
    <View style={{ ...styles.wrapContent, paddingHorizontal: layout.padding }}>
      {data.map((item, index) => (
        <View
          key={item.id}
          style={{
            width: layout.width,
            marginRight: (index + 1) % layout.columns === 0 ? 0 : layout.gap,
            marginBottom: scaleSizeW(GRID_GAP),
          }}
        >
          <Card item={item} width={layout.width} onPress={() => { onPress(item, index) }} />
        </View>
      ))}
    </View>
  )
})

const styles = createStyle({
  scrollContent: {
    paddingLeft: 12,
    paddingRight: 6,
    paddingBottom: 4,
  },
  wrapContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 2,
  },
  card: {
    flexGrow: 0,
    flexShrink: 0,
  },
  name: {
    marginTop: 1,
    lineHeight: 15,
  },
  sub: {
    marginTop: 2,
  },
})

export default CardRow
