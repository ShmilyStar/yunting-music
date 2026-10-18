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
import { HEADER_HEIGHT } from '@/config/constant'
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
  const { height: windowHeight } = useWindowSize()
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

  /** 顶部标题栏高度：播放页面板从它的下框线开始，不覆盖标题栏 */
  const titleBarHeight = statusBarHeight + scaleSizeH(HEADER_HEIGHT)

  /** 面板整体下移自身高度 → 上边缘正好落在底部三 Tab 的上框线处 */
  const startOffset = Math.max(windowHeight - titleBarHeight - bottomBarHeight, 0)

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
    void pop(componentId).then(() => { after?.() })
  }, [componentId, enterAnim])

  const handleSelectTab = useCallback((id: HOME_TAB_ID) => {
    handleClose(() => { switchHomeTab(id) })
  }, [handleClose])

  const handleBack = useCallback(() => {
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
        <View style={{ ...styles.content, backgroundColor: theme['c-content-background'] }}>
          {/*
            07 §3.4：左栏 45% = 封面 + 播放信息/操作行/进度行/控制行，右栏歌词。
            封面在上半区居中，播放器块贴底 —— 竖屏平板时两者之间自然留白。
          */}
          <View style={{ ...styles.left, paddingTop: scaleSizeH(FLOAT_BTN_BAND) }}>
            <Pic />
            <Player />
            <Header onPress={handleClose} />
          </View>
          <View style={styles.right}>
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
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  left: {
    width: '45%',
    flexGrow: 0,
    flexShrink: 0,
    paddingLeft: 12,
    paddingRight: 12,
    // 参考实现的控制行离 Tab 栏上框线约 44dp，留 20 让底边不贴死
    paddingBottom: 20,
  },
  right: {
    flexGrow: 1,
    flexShrink: 1,
  },
})
