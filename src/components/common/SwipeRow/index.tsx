import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Text from '@/components/common/Text'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { setHomePagerSwipeLocked } from '@/utils/homePagerSwipe'

/** 单个操作区宽度，同时也是 snap 档位间距 */
const ACTION_WIDTH = 76

/** 全局登记：当前处于「滑开」状态的行走廊（同一时刻只允许一行滑开，与微信一致） */
const openRows = new Set<() => void>()
const closeOtherRows = (self: () => void) => {
  for (const close of openRows) {
    if (close !== self) close()
  }
}

export interface SwipeAction {
  /** 按钮文案（删除 / 卸载 / 取消收藏…） */
  text: string
  /** 点按钮时触发（调用方负责二次确认） */
  onPress: () => void
  /** 底色，默认红色 */
  color?: string
}

export interface SwipeRowProps {
  children: ReactNode
  /** 左滑露出的操作，按数组顺序从左到右排列 */
  actions: SwipeAction[]
}

/**
 * iOS 风格左滑行（可带多个操作），交互与微信一致：
 *
 * - 滑开后**点左侧可见的内容区只是收起**，不会误触发这一行本身；
 * - 同一时刻只允许一行滑开，滑开新的一行会先关掉上一行；
 * - 点操作按钮才算真的执行。
 *
 * 实现用**原生横向 `ScrollView` + `snapToOffsets`**：列表行外面还套着纵向列表
 * （甚至横向 PagerView），JS 侧 `PanResponder` 抢到 responder 之后会被原生祖先
 * `onInterceptTouchEvent` 收走（实测 grant 之后直接收到 terminate，行不动）。
 * 交给原生滚动视图自己处理横滑就没有争抢问题。
 *
 * **不要再给这个 ScrollView 加 `onStartShouldSetResponderCapture`**：
 * 以前滑开时返回 true 想「吃掉内容区的触摸」，结果把操作按钮的点击也一起吃了
 * —— 真机 iOS 上左滑露出的「取消收藏」点了没反应（用户 2026-10-21 反馈）。
 * 内容区误触由下面那层 `contentMask` Pressable 拦，不需要抢 responder。
 */
export const SwipeRow = memo(({ children, actions }: SwipeRowProps) => {
  const window = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  /** 默认按窗口宽度排布，拿到实际布局宽度后以实测为准 */
  const [contentWidth, setContentWidth] = useState(window.width)
  /** 当前滑开的偏移量（0 = 关闭） */
  const offsetRef = useRef(0)
  const [isOpen, setIsOpen] = useState(false)

  const close = useCallback(() => {
    if (offsetRef.current == 0) return
    scrollRef.current?.scrollTo({ x: 0, animated: true })
    offsetRef.current = 0
    setIsOpen(false)
    openRows.delete(close)
  }, [])

  /** snap 档位：0 = 正常，每多一个按钮多一档 */
  const snapOffsets = useMemo(() => {
    const offsets = [0]
    for (let i = 1; i <= actions.length; i++) offsets.push(ACTION_WIDTH * i)
    return offsets
  }, [actions.length])

  /** 点页面其它空白时收起：由页面调 `closeAllSwipeRows()`，这里只负责登记 */

  useLayoutEffect(() => {
    // 行被移除 / 卸载时从全局走廊里摘掉
    return () => { openRows.delete(close) }
  }, [close])

  /**
   * 按下就暂停父级 PagerView 的翻页，抬手恢复（见 `utils/homePagerSwipe.ts`）。
   *
   * 必须抢在手指移动之前：原生 `ViewPager2` 在第一个超过 touch slop 的
   * MOVE 就会拦截，JS 这边收到 `onTouchStart` 通常还在同一帧内，够早。
   * 三个回调都挂上：手势被祖先取消时只会来 `onTouchCancel`，漏掉会永久
   * 卡住主页翻页。
   */
  const handleTouchStart = useCallback(() => { setHomePagerSwipeLocked(true) }, [])
  const handleTouchEnd = useCallback(() => { setHomePagerSwipeLocked(false) }, [])
  useEffect(() => () => { setHomePagerSwipeLocked(false) }, [])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width
    if (width > 0) setContentWidth(width)
  }, [])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = Math.max(0, Math.round(e.nativeEvent.contentOffset.x))
    offsetRef.current = x
    const open = x > 4
    setIsOpen(open)
    if (open) {
      closeOtherRows(close)
      openRows.add(close)
    } else {
      openRows.delete(close)
    }
  }, [close])

  /**
   * 点操作按钮：**先执行、后收起**。
   *
   * 先收起会立刻重渲染（内容遮罩 / 按钮被移除），实测点击会丢，所以顺序反过来；
   * 动作执行后行通常会从列表移除，或由 `close()` 在下一拍收起。
   *
   * 下一拍的定时器必须存句柄并在卸载时清掉：动作里常常会「删除这一行」，
   * 行被移除后定时器仍会触发，对已卸载组件 setState（开发期报警、生产期无意义开销）。
   */
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  const handleAction = useCallback((onPress: () => void) => {
    onPress()
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      close()
    }, 0)
  }, [close])

  /** 滑开时内容区只负责「收起」，不再把点击透给行本身 */
  const handleContentPress = useCallback(() => { close() }, [close])

  return (
    <View
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <View style={styles.wrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={snapOffsets}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={handleScroll}
          scrollEventThrottle={32}
          style={styles.scroll}
        >
          <View style={[styles.content, { width: contentWidth }]}>
            {children}
            {/* 滑开时盖在内容上：点它 = 收起，避免误进这一行 */}
            {isOpen ? <Pressable style={styles.contentMask} onPress={handleContentPress} /> : null}
          </View>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={`${action.text}-${index}`}
              style={[styles.action, { backgroundColor: action.color ?? REF_ACCENT.red.color }]}
              activeOpacity={0.7}
              onPress={() => { handleAction(action.onPress) }}
            >
              <Text size={13} color="#FFFFFF" numberOfLines={2} style={styles.actionText}>{action.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  )
})

export default SwipeRow

/** 点击页面空白处收起所有滑开的行（由页面在根容器上调用） */
export const closeAllSwipeRows = () => {
  for (const close of [...openRows]) close()
}

const styles = createStyle({
  wrap: {
    flexDirection: 'row',
  },
  scroll: {
    // 行高由内容决定，不被父级拉伸
    flexGrow: 0,
  },
  content: {
    // 必须不透明：否则操作区会从内容底下透出来
    backgroundColor: REF_COLOR.cardBgAlt,
  },
  contentMask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  mask: {
    // 全屏透明层：盖住页面其余部分，点一下就把这一行收起来
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: REF_ACCENT.red.color,
  },
  actionText: {
    textAlign: 'center',
  },
})
