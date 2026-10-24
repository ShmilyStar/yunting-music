import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, AppState, Easing, View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'

import Header from './components/Header'
import DetailPage from './components/DetailPage'
import LyricPage from './components/LyricPage'
import ActionBar from './components/ActionBar'
import PlayBar from './components/PlayBar'
import BottomTabBar, { useBottomBarHeight } from '@/screens/Home/Vertical/BottomTabBar'
import PlayListPopup from '@/components/player/PlayListPopup'
import { pop } from '@/navigation'
import { switchHomeTab } from '@/core/common'
import { HOME_TABS, type HOME_TAB_ID } from '@/config/homeTabs'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useNavStack, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { useBackHandler, useWindowSize } from '@/utils/hooks'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { fallbackTopBarInset, useMainTopBarInset } from '@/utils/topBarInset'
import MainTabHeader from '@/screens/Home/Vertical/MainTabHeader'

/** 双屏：0 歌曲详情 / 1 歌词 */
const PAGE_COUNT = 2
/** 面板划出 / 收回时长（02 §8.2、05 §18） */
const OPEN_DURATION = 300
const CLOSE_DURATION = 240

export interface VerticalProps {
  /** RNN 注入的屏幕 id（播放页用它 pop） */
  componentId: string
  /** 首帧跳过划出动画（RNN 侧也没有转场时用） */
  skipAnimation?: boolean
}

export default memo(({ componentId, skipAnimation = false }: VerticalProps) => {
  const theme = useTheme()
  const [pageIndex, setPageIndex] = useState(0)
  const { height: windowHeight } = useWindowSize()
  const bottomBarHeight = useBottomBarHeight()
  const statusBarHeight = useStatusbarHeight()
  const pagerViewRef = useRef<PagerView>(null)
  const showLyricRef = useRef(false)
  // 1 = 收起（落在三 Tab 上框线处），0 = 完全展开
  const enterAnim = useRef(new Animated.Value(skipAnimation ? 0 : 1)).current
  const [hasStarted, setHasStarted] = useState(skipAnimation)
  const closingRef = useRef(false)

  /**
   * 顶部标题栏的高度（含状态栏）。
   *
   * 播放页面板从标题栏下框线开始，不盖住标题栏；标题栏本身由下层主界面显示，
   * 这里只留同样高度的占位。收起时面板顶边落在底部三 Tab 的上框线，
   * 所以位移 = 面板自身高度（窗口高 − 标题栏 − 底栏）。
   */
  /** 顶栏标题：与主界面一致，取栈底主 Tab（发现 / 音乐馆 / 我的） */
  const navStack = useNavStack()
  const t = useI18n()
  const title = useMemo(() => {
    const tab = HOME_TABS.find(item => item.id == navStack[0]) ?? HOME_TABS[0]
    return t(tab.labelKey)
  }, [navStack, t])

  /**
   * 顶栏下框线的绝对位置（含状态栏）。
   *
   * 用 `MainTabHeader` **实测发布**的值，而不是按 `statusBarHeight + HEADER` 反算：
   * 播放列表面板的上沿、以及面板整体下移的位移都挂在这条线上，
   * 反算在不同分辨率 / 状态栏高度下会有 1~4px 取整误差（弹层会压住标题栏下边框
   * 或露出白缝）。首帧还没测到时自动退回反算值，不会闪位置。
   */
  const titleBarHeight = useMainTopBarInset(fallbackTopBarInset(statusBarHeight))

  /** 面板整体下移自身高度 → 上边缘正好落在底部三 Tab 的上框线处 */
  const startOffset = Math.max(windowHeight - titleBarHeight - bottomBarHeight, 0)

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) screenkeepAwake()
    else screenUnkeepAwake()
  }

  const handleSelectPage = useCallback((index: number) => {
    pagerViewRef.current?.setPage(index)
  }, [])

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
    // pop 与收回动画同时发起：RNN 一 pop 就把下层主界面挂回来，
    // 面板往下收回时露出的是主界面而不是空白
    void pop(componentId).then(() => { after?.() }).catch(() => {
      // pop 失败要给关闭标志复位，否则返回键会永久失效
      closingRef.current = false
    })
  }, [componentId, enterAnim])

  const handleSelectTab = useCallback((id: HOME_TAB_ID) => {
    // 底部 Tab 由本页渲染（几何与主界面同源），点击 = 收起播放页并切主界面
    handleClose(() => { switchHomeTab(id) })
  }, [handleClose])

  const handleBack = useCallback(() => {
    /**
     * 评论页压在播放页上面时，返回键必须由评论页自己处理：这里直接放行，
     * 不能顺手关掉播放页（否则原生栈与 JS 状态错位，主页会整片空白）。
     */
    if (commonState.componentIds.comment) return false
    handleClose()
    return true
  }, [handleClose])

  useBackHandler(handleBack)

  // 首次挂载：从三 Tab 上框线处向上划出
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

  // 歌词屏护屏常亮：退到后台 / 进评论页时恢复
  useEffect(() => {
    const appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (showLyricRef.current && AppState.currentState == 'active') screenkeepAwake()
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
      {/* 顶栏与底栏都由本页自己画（不能靠下层主界面「透出来」：
          面板是不透明的，会把它们挡住）。
          不抖的前提是**两条栏的几何必须和下层主界面完全一致**——
          这里用的 `scaleSizeH(HEADER_HEIGHT)` / `useBottomBarHeight()` /
          `useStatusbarHeight()` 与 `MainTabHeader`、`BottomTabBar` 是同一套来源。 */}
      <MainTabHeader title={title} />
      {/* 面板本身不设背景色：不透明背景画在 content 上，
          这样原生提前挂屏那一瞬间整屏透明，不会闪一下主题色 */}
      <Animated.View style={panelStyle}>
        <View style={{ ...styles.content, backgroundColor: theme['c-content-background'] }}>
          <Header
            pageIndex={pageIndex}
            pageCount={PAGE_COUNT}
            onBack={handleClose}
            onSelectPage={handleSelectPage}
          />
          <View style={styles.body}>
            <PagerView
              ref={pagerViewRef}
              style={styles.pagerView}
              initialPage={0}
              onPageSelected={onPageSelected}
            >
              {/* 两屏都必须控制 pointerEvents：当前屏 auto，另一屏 none */}
              <View
                key="detail"
                collapsable={false}
                testID="lx-playdetail-page-0"
                style={styles.page}
                pointerEvents={pageIndex == 0 ? 'auto' : 'none'}
              >
                <DetailPage componentId={componentId} />
              </View>
              <View
                key="lyric"
                collapsable={false}
                style={styles.page}
                pointerEvents={pageIndex == 1 ? 'auto' : 'none'}
              >
                <LyricPage />
              </View>
            </PagerView>
            {/* 操作行与控制行在 PagerView 之外 → 不随双屏滑动 */}
            <ActionBar />
            <PlayBar />
          </View>
        </View>
      </Animated.View>
      <PlayListPopup topInset={titleBarHeight} />
      {/* 底部 Tab 栏与主界面同一个组件、同一份几何来源，两页叠合时不会错位 */}
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
  },
  body: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  // PagerView 的子页必须自带 flex:1。Android 侧 ViewPagerViewHolder 把子容器
  // 强制设为 MATCH_PARENT，子 View 无 style 也会被拉满；iOS 侧
  // UIViewController+CreateExtension 只做 self.view = view，不覆写 frame，
  // 尺寸全交给 Yoga——缺 flex 时歌词 FlatList 高度塌缩为 0，页面看起来「无歌词」
  page: {
    flex: 1,
  },
})
