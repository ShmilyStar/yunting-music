import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import PagerView, { type PageScrollStateChangedNativeEvent, type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import IconMC from '@/components/common/IconMC'
import Discover from '../Views/Discover'
import Hall from '../Views/Hall'
import Mine from '../Views/Mine'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Leaderboard from '../Views/Leaderboard'
import Mylist from '../Views/Mylist'
import Setting from '../Views/Setting'
import RecentPlay from '../Views/RecentPlay'
import CategoryList from '../Views/CategoryList'
import BoardSongs, { BoardSongsHeader } from '../Views/BoardSongs'
import DownloadManager from '../Views/DownloadManager'
import MainTabHeader from './MainTabHeader'
import SubPageHeader from './SubPageHeader'
import { HOME_TABS, isHomeTabId } from '@/config/homeTabs'
import { type NAV_ID_Type } from '@/config/constant'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { goBackNav, navigateTo, switchHomeTab } from '@/core/common'
import { useNavActiveId, useNavStack } from '@/store/common/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import commonState from '@/store/common/state'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

type T = ReturnType<typeof useI18n>

interface PageItem {
  id: NAV_ID_Type
  render: (t: T) => ReactNode
}

/** 「我的收藏」右侧插槽：打开收藏夹列表弹层 */
const ListDrawerBtn = memo(() => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={styles.headerBtn}
      activeOpacity={0.6}
      onPress={() => { global.app_event.changeLoveListVisible(true) }}
    >
      <IconMC name="playlist-music" size={22} color={theme['c-font']} />
    </TouchableOpacity>
  )
})

const PAGES: PageItem[] = [
  { id: 'nav_discover', render: () => <Discover /> },
  { id: 'nav_hall', render: () => <Hall /> },
  { id: 'nav_mine', render: () => <Mine /> },
  { id: 'nav_search', render: t => <><SubPageHeader title={t('nav_search')} /><Search /></> },
  { id: 'nav_songlist', render: t => <><SubPageHeader title={t('nav_songlist')} /><SongList /></> },
  { id: 'nav_top', render: t => <><SubPageHeader title={t('nav_top')} /><Leaderboard /></> },
  { id: 'nav_love', render: t => <><SubPageHeader title={t('nav_love')} right={<ListDrawerBtn />} /><Mylist /></> },
  { id: 'nav_setting', render: t => <><SubPageHeader title={t('nav_setting')} /><Setting /></> },
  { id: 'nav_recent', render: t => <><SubPageHeader title={t('recent_play')} /><RecentPlay /></> },
  { id: 'nav_hot_songs', render: t => <><SubPageHeader title={t('hall_song')} /><CategoryList mode="song" /></> },
  { id: 'nav_singers', render: t => <><SubPageHeader title={t('hall_singer')} /><CategoryList mode="singer" /></> },
  { id: 'nav_albums', render: t => <><SubPageHeader title={t('hall_album')} /><CategoryList mode="album" /></> },
  { id: 'nav_board_songs', render: () => <><BoardSongsHeader /><BoardSongs /></> },
  { id: 'nav_download', render: t => <><SubPageHeader title={t('hall_download')} /><DownloadManager /></> },
]

const VIEW_MAP: Partial<Record<NAV_ID_Type, number>> = {}
const INDEX_MAP: NAV_ID_Type[] = []
PAGES.forEach((page, index) => {
  VIEW_MAP[page.id] = index
  INDEX_MAP[index] = page.id
})

const TAB_TITLE_KEYS = new Map(HOME_TABS.map(tab => [tab.id as string, tab.labelKey]))
const MAIN_TAB_INDEXES = new Set(HOME_TABS.map((_, i) => i))

/** 内层：只接收稳定引用，memo 才能命中 */
const PageBody = memo(({ page, t }: { page: PageItem, t: T }) => (
  <>{page.render(t)}</>
))

/** 外层：承接 PagerView 注入的 style，不做 memo */
const PageSlot = ({ page, t, active, style }: {
  page: PageItem
  t: T
  /** 是否是当前展示页 —— 非当前页必须对触摸透明 */
  active: boolean
  style?: StyleProp<ViewStyle>
}) => (
  <View
    collapsable={false}
    pointerEvents={active ? 'auto' : 'none'}
    style={[styles.pageStyle, style]}
  >
    <PageBody page={page} t={t} />
  </View>
)

const TabPages = ({ activeId }: { activeId: NAV_ID_Type }) => {
  const t = useI18n()
  const homePageScroll = useSettingValue('common.homePageScroll')
  const navStack = useNavStack()
  const pagerViewRef = useRef<PagerView>(null)
  const activeIndex = VIEW_MAP[activeId] ?? 0
  const activeIndexRef = useRef(activeIndex)
  const isMainTab = MAIN_TAB_INDEXES.has(activeIndex)
  const visitedRef = useRef<Set<number>>(new Set([activeIndex]))
  const [, forceUpdateTick] = useState(0)
  const forceUpdate = useCallback(() => { forceUpdateTick(v => v + 1) }, [])

  /** 顶部标题栏永远显示当前主 Tab（栈底），二级页在它下面再排自己的返回栏 */
  const title = useMemo(() => {
    const baseTabId = navStack[0] ?? HOME_TABS[0].id
    return t(TAB_TITLE_KEYS.get(baseTabId) ?? 'tab_discover')
  }, [navStack, t])

  useEffect(() => {
    const index = VIEW_MAP[activeId] ?? 0
    if (!visitedRef.current.has(index)) {
      visitedRef.current.add(index)
      forceUpdate()
    }
    if (activeIndexRef.current == index) return
    activeIndexRef.current = index
    pagerViewRef.current?.setPageWithoutAnimation(index)
  }, [activeId, forceUpdate])

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    const index = nativeEvent.position
    if (activeIndexRef.current == index) return
    activeIndexRef.current = index
    const id = INDEX_MAP[index]
    if (!id) return
    // 主 Tab 之间滑动 → 切主 Tab；滑到二级页 → 入栈
    if (isHomeTabId(id)) switchHomeTab(id)
    else navigateTo(id)
  }, [])

  const onPageScrollStateChanged = useCallback(({ nativeEvent }: PageScrollStateChangedNativeEvent) => {
    const idle = nativeEvent.pageScrollState == 'idle'
    if (global.lx.homePagerIdle != idle) global.lx.homePagerIdle = idle
  }, [])

  return (
    <>
      <MainTabHeader title={title} />
      <PagerView
        ref={pagerViewRef}
        initialPage={activeIndexRef.current}
        offscreenPageLimit={1}
        onPageSelected={onPageSelected}
        onPageScrollStateChanged={onPageScrollStateChanged}
        // 只有三个主 Tab 之间可滑动
        scrollEnabled={isMainTab && !!homePageScroll}
        style={styles.pagerView}
      >
        {PAGES.map((page, index) =>
          visitedRef.current.has(index)
            ? <PageSlot key={page.id} page={page} t={t} active={index === activeIndex} />
            : <View collapsable={false} key={page.id} style={styles.pageStyle} pointerEvents="none" />,
        )}
      </PagerView>
    </>
  )
}

export default memo(() => {
  const activeId = useNavActiveId()

  useBackHandler(useCallback(() => {
    if (commonState.navStack.length > 1) {
      goBackNav()
      return true
    }
    return false // 放行给系统（退出应用）
  }, []))

  return <TabPages activeId={activeId} />
})

const styles = createStyle({
  pagerView: {
    flex: 1,
    overflow: 'hidden',
  },
  pageStyle: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
