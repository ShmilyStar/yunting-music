import { memo, useMemo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import Image from '@/components/common/Image'
import { REF_ACCENT, type RefAccentKey } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useIsTabletLayout, useWindowSize } from '@/utils/hooks'

/** 横向滚动模式的卡片宽度（设计值） */
const CARD_WIDTH = 100
/** 折行模式的左右留白、卡片间距（设计值） */
const GRID_PADDING = 12
const GRID_GAP = 10
/** 容器宽 ≥ 1000 才允许一行 8 个，否则一律 4 个（发现页 8 个歌单正好两行） */
const GRID_FULL_ROW_WIDTH = 1000
const GRID_WIDE_COLUMNS = 8
const GRID_NARROW_COLUMNS = 4
/** 缩略图里图标占方块边长的比例（与横滑模式 44/104 保持一致） */
const ICON_RATIO = 44 / CARD_WIDTH

/** 平板：卡片间距比手机略紧，给列数让宽度 */
const TABLET_GAP = 8
/** 平板竖屏最多 4 列（与参考图一致），横屏按宽度最多 8 列 */
const TABLET_PORTRAIT_COLUMNS = 4
const TABLET_LANDSCAPE_COLUMNS = 8

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
  /** scroll：榜单行（平板下超出可左滑）；wrap：歌单网格 */
  mode?: 'scroll' | 'wrap'
  onPress: (item: CardItem, index: number) => void
  /**
   * 实际可用的宽度（dp）。
   *
   * 平板按整屏宽度算列数；若页面把内容收窄（长条大屏手机），要传收窄后的宽度，
   * 否则卡片会排到内容区外面。不传则用整屏宽度。
   */
  availableWidth?: number
  /** 固定列数（发现页首屏一屏放完时用：手机/竖屏 4 列，横屏 8 列） */
  columns?: number
  /** 卡片封面边长上限（dp）：由可用高度反推，榜单与歌单必须传同一个值 */
  maxWidth?: number
  /** 名称只显示一行（首屏一屏放完时用，省出文字高度） */
  oneLine?: boolean
}

const Cover = memo(({ item, width, radius }: { item: CardItem, width: number, radius: number }) => {
  const accent = REF_ACCENT[item.accent ?? 'green']
  return (
    <View style={{
      width,
      aspectRatio: 1,
      borderRadius: radius,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      elevation: 2,
      backgroundColor: accent.bg,
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

/**
 * 卡片：封面 + 名称（+ 副标题）。
 *
 * `onPressItem` 回传 `(item, index)`，调用方不用为每张卡新建闭包，`memo` 才生效。
 */
const Card = memo(({ item, index, width, tablet, oneLine, onPressItem }: {
  item: CardItem
  index: number
  width: number
  tablet: boolean
  oneLine: boolean
  onPressItem: (item: CardItem, index: number) => void
}) => (
  <TouchableOpacity style={{ ...styles.card, width }} activeOpacity={0.7} onPress={() => { onPressItem(item, index) }}>
    <Cover item={item} width={width} radius={tablet ? 8 : 6} />
    <Text size={tablet ? 13 : 12} numberOfLines={oneLine ? 1 : 2} style={styles.name}>{item.name}</Text>
    {item.sub ? <Text size={tablet ? 11 : 10} numberOfLines={1} color={REF_ACCENT.green.color} style={styles.sub}>{item.sub}</Text> : null}
  </TouchableOpacity>
))

/**
 * 卡片行：封面 + 名称（+ 副标题）。
 *
 * - 手机：榜单横滑、歌单 4 列折行（与原来一致）；
 * - 平板：按可用宽度自适应 4~8 列；榜单横滑时卡片宽度与网格一致，
 *   不再出现「手机卡片大小铺在平板中间」或「8 列被挤成图标」。
 */
export const CardRow = memo(({ data, mode = 'scroll', onPress, availableWidth, columns: columnsProp, maxWidth, oneLine = false }: CardRowProps) => {
  const windowSize = useWindowSize()
  const isTablet = useIsTabletLayout()
  const fullWidth = windowSize.width
  const landscape = fullWidth > windowSize.height

  const layout = useMemo(() => {
    const target = availableWidth ?? fullWidth
    const outerPadding = scaleSizeW(GRID_PADDING)

    const columns = columnsProp ?? (isTablet
      ? (landscape ? TABLET_LANDSCAPE_COLUMNS : TABLET_PORTRAIT_COLUMNS)
      : (fullWidth >= GRID_FULL_ROW_WIDTH ? GRID_WIDE_COLUMNS : GRID_NARROW_COLUMNS))

    /**
     * 布局策略：**固定列数 + 卡片取整 + 间距自适应**（用户 2026-10-21 建议的方案）。
     *
     * 以前是「间距固定、卡片宽度带小数摊掉余量」：真机布局会取整，
     * 当 `列数×卡片 + (列数-1)×间距` 恰好等于容器宽时，取整后比容器宽出不到 1dp，
     * 最后一张就被挤到下一行——表现为「一行 3 个、第 5 张换行」的宫格错乱
     * （字体调到某个值时余量正好卡在边界上必然复现，更大或更小时反而正常）。
     *
     * 现在把「余量」放到间距上：
     * 1. 卡片宽度 = 按基准间距算出后**向下取整**（整数，不产生小数误差）；
     * 2. 间距 = 剩余空间 ÷ (列数-1)，把除不尽的余量全部摊进列间距，
     *    于是 `列数×卡片 + (列数-1)×间距` **恒等于**容器宽减去左右留白；
     * 3. 左右留白保持固定，整行贴边对齐——不会出现右侧空一小截或溢出。
     *
     * 这样无论屏宽、DPI、字号怎么变，一行都稳定放下 `columns` 张，不会错位。
     */
    const usable = Math.max(1, target - outerPadding * 2)

    // 基准间距：平板略紧，手机默认 10dp（经缩放）
    const baseGap = Math.round(scaleSizeW(isTablet ? TABLET_GAP : GRID_GAP))
    let width = Math.floor((usable - baseGap * (columns - 1)) / columns)
    if (maxWidth != null) width = Math.min(width, Math.floor(maxWidth))
    width = Math.max(1, width)

    // 用不上的余量摊进列间距（列数 > 1 时），保证整行正好铺满
    const free = usable - width * columns
    const gap = columns > 1
      ? Math.max(0, Math.floor(free / (columns - 1)))
      : baseGap

    const rowWidth = Math.min(Math.floor(target), columns * width + gap * (columns - 1) + outerPadding * 2)
    return { gap, padding: Math.round(outerPadding), columns, width, rowWidth }
  }, [availableWidth, columnsProp, fullWidth, isTablet, landscape, maxWidth])

  // 榜单横滑：卡宽与歌单网格一致；发现页首屏放不下时由 `maxWidth` 统一收小
  if (mode == 'scroll') {
    const cardWidth = maxWidth != null ? layout.width : (isTablet ? layout.width : scaleSizeW(CARD_WIDTH))
    const gap = layout.gap
    return (
      <View style={{ width: layout.rowWidth, alignSelf: 'center' }}>
        <ScrollView
          horizontal
          style={{ flexGrow: 0, flexShrink: 0, width: layout.rowWidth }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingLeft: layout.padding,
            paddingRight: layout.padding,
            paddingBottom: 2,
          }}
        >
          {data.map((item, index) => (
            <View key={item.id} style={{ marginRight: index == data.length - 1 ? 0 : gap }}>
              <Card item={item} index={index} width={cardWidth} tablet={isTablet} oneLine={oneLine} onPressItem={onPress} />
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={{
      ...styles.wrapContent,
      width: layout.rowWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.padding,
      // 整行按页面宽度居中；榜单行用同一个 `rowWidth` 居中，两者左边缘保持一致
      justifyContent: 'flex-start',
    }}>
      {data.map((item, index) => (
        <View
          key={item.id}
          style={{
            width: layout.width,
            marginRight: (index + 1) % layout.columns === 0 ? 0 : layout.gap,
            marginBottom: layout.gap,
          }}
        >
          <Card item={item} index={index} width={layout.width} tablet={isTablet} oneLine={oneLine} onPressItem={onPress} />
        </View>
      ))}
    </View>
  )
})

export default CardRow

const styles = createStyle({
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
    lineHeight: 16,
  },
  sub: {
    marginTop: 2,
  },
})
