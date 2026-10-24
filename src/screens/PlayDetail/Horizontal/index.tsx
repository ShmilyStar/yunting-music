import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, AppState, Easing, View } from 'react-native'

import Header from './components/Header'
import FloatBtns from './FloatBtns'
import Pic from './Pic'
import Lyric from './Lyric'
import Player from './Player'
import PlayListPopup from '@/components/player/PlayListPopup'
import BottomTabBar, { useBottomBarHeight } from '@/screens/Home/Vertical/BottomTabBar'
import MainTabHeader from '@/screens/Home/Vertical/MainTabHeader'
import { pop } from '@/navigation'
import { switchHomeTab } from '@/core/common'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useNavStack, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { useBackHandler, useWindowSize } from '@/utils/hooks'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { fallbackTopBarInset, useMainTopBarInset } from '@/utils/topBarInset'
import { HOME_TABS, type HOME_TAB_ID } from '@/config/homeTabs'

/** 面板划出 / 收回时长（02 §8.2、05 §18） */
const OPEN_DURATION = 300
const CLOSE_DURATION = 240
/**
 * 内容区顶部留白（设计值）。
 *
 * 返回键 / 定时关闭都是浮层，不占内容高度：只留出状态栏 + 一点点间距，
 * 让左栏封面与右栏歌词都能用满竖向空间。
 */
const FLOAT_BTN_BAND = 4

/**
 * 歌词区左右留白（dp）由 `./Lyric` 的容器提供（它的 `paddingLeft/Right = 20`）。
 * 这里只负责把歌词框定在屏幕右半边，留白不要再叠加一次，否则会变成 40dp。
 */

/**
 * 宽屏（横屏或最短边 ≥600dp）播放页：左右分栏。
 *
 * 左栏大封面 + 歌词，右栏播放信息与控制；控制行用 icomoon 字形，
 * 播放器设置弹层 `direction="horizontal" position="left"`（03 §12.2）。
 */
export interface HorizontalProps {
  /** RNN 注入的屏幕 id（播放页用它 pop） */
  componentId: string
  /** 首帧跳过划出动画（RNN 侧也没有转场时用） */
  skipAnimation?: boolean
}

export default memo(({ componentId, skipAnimation = false }: HorizontalProps) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const navStack = useNavStack()
  const { width: windowWidth, height: windowHeight } = useWindowSize()
  const bottomBarHeight = useBottomBarHeight()
  // 1 = 收起（落在三 Tab 上框线处），0 = 完全展开
  const enterAnim = useRef(new Animated.Value(skipAnimation ? 0 : 1)).current
  const [hasStarted, setHasStarted] = useState(skipAnimation)
  const closingRef = useRef(false)

  /** 顶部标题栏（栈底主 Tab：发现 / 音乐馆 / 我的） */
  const title = useMemo(() => {
    const tab = HOME_TABS.find(item => item.id == navStack[0]) ?? HOME_TABS[0]
    return t(tab.labelKey)
  }, [navStack, t])

  /**
   * 顶栏下框线：用 `MainTabHeader` 实测发布的值（与播放列表弹层同一来源），
   * 反算在不同分辨率下会差 1~4px。
   */
  const titleBarHeight = useMainTopBarInset(fallbackTopBarInset(statusBarHeight))

  /** 面板整体下移自身高度 → 上边缘正好落在底部三 Tab 的上框线处 */
  const startOffset = Math.max(windowHeight - titleBarHeight - bottomBarHeight, 0)

  /**
   * 半屏宽度（dp）。两处锚点都用它：
   * - 左栏宽度 = 半屏（内容在左半边居中）；
   * - 播放器设置弹层宽度 = 半屏（`position: left` 从屏幕左边贴齐，右缘正好落在
   *   屏幕中线上 —— 用户 2026-10-24 要求「设置弹窗右侧边缘与屏幕中心齐平」）。
   */
  const halfWidth = Math.max(Math.floor(windowWidth / 2), 0)

  /**
   * 左栏内容列宽（dp）：半屏宽减去栏内左右内边距（12+12）。
   *
   * 内容列按这个宽度在左半边**居中**，两侧自然留出等宽空白；换分辨率时
   * 跟着窗口实时重算（`windowWidth` 来自 `useWindowSize`）。
   */
  const leftContentWidth = Math.max(halfWidth - 24, 0)

  /** 先反向收回，再关闭播放页 */
  const handleClose = useCallback((after?: () => void) => {
    if (closingRef.current) return
    closingRef.current = true
    setHasStarted(true)
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start()
    void pop(componentId).then(() => { after?.() }).catch(() => {
      // pop 失败要给关闭标志复位，否则返回键会永久失效
      closingRef.current = false
    })
  }, [componentId, enterAnim])

  const handleSelectTab = useCallback((id: HOME_TAB_ID) => {
    handleClose(() => { switchHomeTab(id) })
  }, [handleClose])

  const handleBack = useCallback(() => {
    // 评论页压在播放页上面时必须由评论页自己 pop，这里放行（见 Vertical 同处说明）
    if (commonState.componentIds.comment) return false
    handleClose()
    return true
  }, [handleClose])

  useBackHandler(handleBack)

  useEffect(() => {
    let raf: number | undefined
    if (!skipAnimation) {
      raf = requestAnimationFrame(() => {
        setHasStarted(true)
        Animated.timing(enterAnim, {
          toValue: 0,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      })
    }
    return () => { if (raf != null) cancelAnimationFrame(raf) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 宽屏歌词常显：进入即保持屏幕常亮，进评论页或退到后台恢复
  useEffect(() => {
    screenkeepAwake()
    const appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (!commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, startOffset],
  })

  // 首帧先用静态位移落位，避免原生驱动动画在第一帧闪一下
  const panelStyle = hasStarted
    ? { ...styles.panel, transform: [{ translateY }] }
    : { ...styles.panel, transform: [{ translateY: startOffset }] }

  return (
    <View style={styles.root}>
      {/* 顶部标题栏固定显示：播放页面板从它的下框线开始，不覆盖标题栏 */}
      <MainTabHeader title={title} />
      {/* 面板本身不设背景色：不透明背景画在 content 上 */}
      <Animated.View style={panelStyle}>
        {/*
          左右各半屏（用户 2026-10-24 要求）：
          - 左栏：内容整体在**屏幕左半边横向居中**（只调横向，纵向沿用原始排布）；
          - 右栏：歌词以屏幕中线为界占右半边，两侧各留 20dp 后居中。
        */}
        <View style={{ ...styles.content, backgroundColor: theme['c-content-background'] }}>
          {/*
            左栏外层仍是半屏宽，`alignItems: 'center'` 让内层这一列横向居中。
            **不加 `height: '100%'`、不改内层高度**：纵向沿用原始参数
            （`Pic` 的 `flexGrow: 1` + `flexBasis: 0` 按剩余高度分配），
            只有横向被重新居中。
          */}
          <View style={{ ...styles.left, width: halfWidth, paddingTop: scaleSizeH(FLOAT_BTN_BAND) }}>
            <View style={{ ...styles.leftInner, width: leftContentWidth }}>
              <Pic />
              <Player panelWidth={halfWidth} />
              <Header onPress={handleClose} />
            </View>
          </View>
          {/*
            歌词：绝对定位钉在屏幕中线右侧，`left: '50%'` 相对铺满全屏的面板，
            因此与左栏宽度无关；两侧留白由 `Lyric` 自身的 20dp 内边距提供。
          */}
          <View style={styles.lyric}>
            <Lyric />
          </View>
        </View>
        {/* 定时关闭：顶栏水平居中（07 §3.4） */}
        <FloatBtns />
      </Animated.View>
      <PlayListPopup topInset={titleBarHeight} />
      <BottomTabBar onSelect={handleSelectTab} />
    </View>
  )
})

const styles = createStyle({
  root: {
    flex: 1,
  },
  panel: {
    flex: 1,
  },
  /** 右半部分：左栏与歌词共用的容器层 */
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  /**
   * 左栏：占屏幕左半边，内部这一列**横向居中**。
   *
   * 纵向参数全部沿用 76542765 原始实现（12/12 左右内边距、20 底边留白），
   * 由 `Pic`(flexGrow:1 + flexBasis:0) 与播放器块(flexShrink:0) 分配竖向空间；
   * 这里只用 `alignItems: 'center'` 做横向居中，**不要加 height、不要改
   * `alignItems: 'stretch'`** —— 用户明确要求只调整横向，不动纵向。
   */
  left: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    // 参考实现的控制行离 Tab 栏上框线约 44dp，留 20 让底边不贴死
    paddingBottom: 20,
  },
  /**
   * 左栏内层：一列内容，宽度由组件给成 `leftContentWidth`。
   *
   * 高度用 `flexGrow: 1` 撑满栏内可用高度，使 `Pic` 的剩余高度分配与原始版本
   * 一致（纵向不变）。不要写死高度或百分比，否则 `Pic` 的 `flexBasis: 0`
   * 会失去基准、整块播放器塌掉。
   */
  leftInner: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  /**
   * 歌词：以**屏幕中线**为界占右半边，两侧各留 20dp 后居中。
   *
   * 用绝对定位而不是行内 flex：行内排布下 `left: '50%'` 是相对左栏算的，
   * 实测会把歌词推到屏幕右侧只剩几个像素；绝对定位的 `left/right` 直接相对
   * 铺满全屏的 `panel`，才真正「以屏幕中心为界」，且与左栏宽度无关、换分辨率自适应。
   * 20dp 留白由 `Lyric` 自身容器的 `paddingLeft/Right` 提供，此处不再叠加。
   */
  lyric: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    right: 0,
  },
})
