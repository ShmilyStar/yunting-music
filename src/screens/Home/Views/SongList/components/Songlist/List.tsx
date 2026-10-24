import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { FlatList, View, RefreshControl, type FlatListProps } from 'react-native'

import ListItem from './ListItem'
// import { navigations } from '@/navigation'
import { type ListInfoItem } from '@/store/songlist/state'
import { useWindowSize } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'

type FlatListType = FlatListProps<ListInfoItem>

/**
 * 列表左右内边距（与 `styles.list` 的 `paddingLeft/Right` 同值，未缩放）。
 * 算宫格宽度时必须先扣掉它，否则「卡片×列数 + 间距」会比真实可用宽度大 20dp，
 * 最后一列被挤出屏幕（实测 Android 1206×2622 右侧卡片被裁掉一条）。
 */
const LIST_PADDING_H = 10
/**
 * 目标卡片宽度（设计值）。
 *
 * 列数由「可用宽度 ÷ 目标卡宽」四舍五入得出，而不是「不小于最小卡宽」向下取整：
 * 后者在 400dp 左右的手机上会退化成 2 列、卡片被拉到 ~195dp（用户 2026-10-21
 * 反馈「歌单一行 3 个」），手机档现在稳定落 3 列，平板按宽度自然增多。
 */
const TARGET_CARD = scaleSizeW(110)
const GAP = scaleSizeW(20)

export interface ListProps {
  onRefresh: () => void
  onLoadMore: () => void
  onOpenDetail: (item: ListInfoItem, index: number) => void
}
export type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'

export interface ListType {
  setList: (list: ListInfoItem[], showSource?: boolean) => void
  setStatus: (val: Status) => void
}

export default forwardRef<ListType, ListProps>(({ onRefresh, onLoadMore, onOpenDetail }, ref) => {
  const flatListRef = useRef<FlatList>(null)
  const [currentList, setList] = useState<ListInfoItem[]>([])
  const [showSource, setShowSource] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  // 列数订阅窗口尺寸变化重算：不用容器 onLayout——旋转重挂载后 onLayout
  // 不保证触发，会导致列数冻结。
  const windowSize = useWindowSize()
  const width = windowSize.width
  const theme = useTheme()
  useImperativeHandle(ref, () => ({
    setList(list, showSource = false) {
      // rawListRef.current = list
      setList(list)
      setShowSource(showSource)
    },
    setStatus(val) {
      setStatus(val)
    },
  }))

  const handleLoadMore = () => {
    if (status != 'idle') return
    onLoadMore()
  }

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      item={item}
      index={index}
      width={rowInfo.width}
      showSource={showSource}
      onPress={onOpenDetail}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item.id
  // const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
  //   return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  // }
  const refreshControl = useMemo(() => (
    <RefreshControl
      colors={[theme['c-primary']]}
      // progressBackgroundColor={theme.primary}
      refreshing={status == 'refreshing'}
      onRefresh={onRefresh} />
  ), [status, onRefresh, theme])
  const footerComponent = useMemo(() => {
    let label: FooterLabel
    switch (status) {
      case 'refreshing': return null
      case 'loading':
        label = 'list_loading'
        break
      case 'end':
        label = 'list_end'
        break
      case 'error':
        label = 'list_error'
        break
      case 'idle':
        label = null
        break
    }
    return (
      <View style={{ width: '100%' }}>
        <Footer label={label} onLoadMore={onLoadMore} />
      </View>
    )
  }, [onLoadMore, status])

  /**
   * 宫格几何：**固定列数 + 卡片取整 + 间距自适应**（用户 2026-10-21 要求，
   * 与发现页 / 搜索页的宫格保持同一套规则）。
   *
   * 以前是「间距固定 GAP、卡片宽度带小数摊余量」，真机布局取整后
   * `列数×卡片 + (列数-1)×间距` 会比容器宽出不到 1dp，最后一列被挤到下一行，
   * 表现为「一行 3 个但参差不齐」。
   *
   * 现在：
   * 1. 列数 = `round(可用宽度 / 目标卡宽)`（可用宽度 = 窗口宽 − 左右内边距），最多 10 列；
   * 2. 卡片宽度向下取整，**不产生小数误差**；
   * 3. 剩余空间全部摊进列间距，行宽恒等于可用宽度 → 两边贴边、整体居中。
   */
  const rowInfo = useMemo(() => {
    const available = Math.max(1, width - LIST_PADDING_H * 2)
    const cols = width > 0
      ? Math.max(2, Math.min(Math.round(available / TARGET_CARD), 10))
      : 2
    // 先按基准间距估算卡片宽度，再取整
    let cardW = Math.floor((available - GAP * (cols - 1)) / cols)
    if (cardW < 1) cardW = 1
    // 余量摊进间距（列数 > 1 时），保证整行正好铺满
    const gap = cols > 1 ? Math.max(0, Math.floor((available - cardW * cols) / (cols - 1))) : 0
    return {
      num: cols,
      width: cardW,
      gap,
    }
  }, [width])
  const list = useMemo(() => {
    const list = [...currentList]
    let whiteItemNum = (list.length % rowInfo.num)
    if (whiteItemNum > 0) whiteItemNum = rowInfo.num - whiteItemNum
    for (let i = 0; i < whiteItemNum; i++) {
      list.push({
        id: `white__${i}`,
        play_count: '',
        author: '',
        name: '',
        img: '',
        desc: '',
        // @ts-expect-error
        source: '',
      })
    }
    return list
  }, [currentList, rowInfo])
  return (
    <View style={styles.container}>
      {
        width == 0
          ? null
          : (
              <FlatList
                key={String(rowInfo.num)}
                ref={flatListRef}
                style={styles.list}
                /**
                 * 列间距由 `rowInfo.gap`（自适应算出来的整数）控制，
                 * 不再用 `space-evenly` 让系统自己分：
                 * 自定义间距才能保证「卡片×列数 + 间距×(列数-1)」精确等于容器宽，
                 * 从而左右两边严格贴边对齐。
                 */
                columnWrapperStyle={{ gap: rowInfo.gap }}
                numColumns={rowInfo.num}
                data={list}
                maxToRenderPerBatch={4}
                // updateCellsBatchingPeriod={80}
                windowSize={8}
                removeClippedSubviews={true}
                // initialNumToRender={12}
                renderItem={renderItem}
                keyExtractor={getkey}
                // getItemLayout={getItemLayout}
                // onRefresh={onRefresh}
                // refreshing={refreshing}
                onEndReachedThreshold={0.6}
                onEndReached={handleLoadMore}
                refreshControl={refreshControl}
                ListFooterComponent={footerComponent}
              />
            )
      }
    </View>
  )
})

type FooterLabel = 'list_loading' | 'list_end' | 'list_error' | null
const Footer = ({ label, onLoadMore }: {
  label: FooterLabel
  onLoadMore: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const handlePress = () => {
    if (label != 'list_error') return
    onLoadMore()
  }
  return (
    label
      ? (
          <View>
            <Text onPress={handlePress} style={styles.footer} color={theme['c-font-label']}>{t(label)}</Text>
          </View>
        )
      : null
  )
}


const styles = createStyle({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
  footer: {
    textAlign: 'center',
    padding: 10,
  },
})
