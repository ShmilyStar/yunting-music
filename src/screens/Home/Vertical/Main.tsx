import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native'
import PagerView from 'react-native-pager-view'
import Discover from '../Views/Discover'
import Mine from '../Views/Mine'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Leaderboard from '../Views/Leaderboard'
import Mylist from '../Views/Mylist'
import Setting from '../Views/Setting'
import RecentPlay from '../Views/RecentPlay'
import { BoardSongsPage, BoardSongsHeader } from '../Views/BoardSongs'
import LocalMusic, { LocalMusicHeaderBtn } from '../Views/LocalMusic'
import MainTabHeader from './MainTabHeader'
import SubPageHeader from './SubPageHeader'
import IconMC from '@/components/common/IconMC'
import { REF_COLOR } from '@/config/uiPalette'
import { HOME_TABS, isHomeTabId } from '@/config/homeTabs'
import { type NAV_ID_Type } from '@/config/constant'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { goBackNav, navigateTo, switchHomeTab } from '@/core/common'
import { pop } from '@/navigation/utils'
import { useNavActiveId, useNavStack } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useHomePagerSwipeLocked } from '@/utils/homePagerSwipe'
import commonState from '@/store/common/state'

type T = ReturnType<typeof useI18n>

interface PageItem {
  id: NAV_ID_Type
  render: (t: T) => ReactNode
}

/** 「我的列表」页标题栏右侧的插槽（已按需求移除，保留说明避免误加回去） */

/**
 * 「本地歌曲」页的顶栏：标题只显示**当前目录名**（在目录列表时显示「本地歌曲」），
 * 返回键在子目录里回到上一层，在目录列表里回到音乐馆；
 * 入口图标（文件夹）与菜单也都在这一行，页面里不再有自己的横条。
 */
const LocalMusicPage = memo(() => {
  const t = useI18n()
  const [headerAction, setHeaderAction] = useState<{ action: 'addDir' | 'scan', seq: number } | null>(null)
  const [nav, setNav] = useState({ title: '', canGoBack: false })
  const [backSeq, setBackSeq] = useState(0)
  const actionSeqRef = useRef(0)
  const backSeqRef = useRef(0)

  const handleHeaderPress = useCallback((action: 'addDir' | 'scan') => {
    actionSeqRef.current += 1
    setHeaderAction({ action, seq: actionSeqRef.current })
  }, [])

  const handleNavChange = useCallback((next: { title: string, canGoBack: boolean }) => {
    setNav(prev => prev.title === next.title && prev.canGoBack === next.canGoBack ? prev : next)
  }, [])

  const handleBack = useCallback(() => {
    if (!nav.canGoBack) {
      goBackNav()
      return
    }
    backSeqRef.current += 1
    setBackSeq(backSeqRef.current)
  }, [nav.canGoBack])

  return (
    <>
      <SubPageHeader
        title={nav.title || t('hall_local_music')}
        onBack={handleBack}
        right={<LocalMusicHeaderBtn onPress={handleHeaderPress} />}
      />
      <LocalMusic headerAction={headerAction} onNavChange={handleNavChange} backSeq={backSeq} />
    </>
  )
})

const PAGES: PageItem[] = [
  { id: 'nav_discover', render: () => <Discover /> },
  { id: 'nav_mine', render: () => <Mine /> },
  { id: 'nav_search', render: t => <><SubPageHeader title={t('nav_search')} /><Search /></> },
  { id: 'nav_songlist', render: t => <><SubPageHeader title={t('nav_songlist')} /><SongList /></> },
  { id: 'nav_top', render: t => <><SubPageHeader title={t('nav_top')} /><Leaderboard /></> },
  { id: 'nav_love', render: t => <><SubPageHeader title={t('nav_love')} /><Mylist /></> },
  { id: 'nav_setting', render: t => <><SubPageHeader title={t('nav_setting')} /><Setting /></> },
  { id: 'nav_recent', render: t => <><SubPageHeader title={t('recent_play')} /><RecentPlay /></> },
  { id: 'nav_board_songs', render: () => <><BoardSongsHeader /><BoardSongsPage /></> },
  // 「已下载」仅作为本地歌曲页固定第一行的目录（磁盘路径），不再有独立页面
  { id: 'nav_local_music', render: () => <LocalMusicPage /> },
  // 歌手 / 专辑 / 音乐馆宫格入口已按需求移除
]

/**
 * Pager 里**只放两个主 Tab**（发现 / 我的）。
 *
 * 这是「左滑不抖」的关键：以前二级页（搜索 / 歌单 / 设置…）也排在同一个 Pager 里，
 * 「我的」左边紧挨着搜索页，于是左滑会被原生 ViewPager2 拖走，只能靠 JS 在滑动
 * 过程中把它拽回来 —— 每帧拉一次，看起来就是整屏晃动。现在 Pager 只有两页，
 * 两端都是原生边界：发现页右滑没反应、我的页左滑也没反应，效果完全一样。
 *
 * 二级页改为画在 Pager **上面**的一层里（见下面的 `layers`），挂载策略与以前一致：
 * 打开过的常驻，返回后再进不丢状态。
 */
const MAIN_PAGE_IDS: NAV_ID_Type[] = HOME_TABS.map(tab => tab.id)
const MAIN_PAGES = MAIN_PAGE_IDS
  .map(id => PAGES.find(page => page.id === id))
  .filter((page): page is PageItem => page != null)
const PAGE_BY_ID = new Map<NAV_ID_Type, PageItem>(PAGES.map(page => [page.id, page]))

const TAB_TITLE_KEYS = new Map(HOME_TABS.map(tab => [tab.id as string, tab.labelKey]))

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
  const theme = useTheme()
  const navStack = useNavStack()
  const pagerViewRef = useRef<PagerView>(null)
  /** 栈底的主 Tab：顶栏标题与 Pager 当前页都以它为准 */
  const mainId = navStack[0] ?? MAIN_PAGE_IDS[0]
  const mainIndex = Math.max(MAIN_PAGE_IDS.indexOf(mainId), 0)
  const activeIndexRef = useRef(mainIndex)
  /** 当前页如果是二级页，它就是那一页；否则 null */
  const secondaryId = isHomeTabId(activeId) ? null : activeId
  /** 打开过的二级页：常驻挂载，返回后再进不丢状态（与以前一致） */
  const [visitedSecondary, setVisitedSecondary] = useState<NAV_ID_Type[]>([])
  /** 行内左滑删除正在触摸 → 暂停翻页（见 utils/homePagerSwipe.ts） */
  const rowTouching = useHomePagerSwipeLocked()

  /** 顶部标题栏永远显示当前主 Tab（栈底），二级页在它下面再排自己的返回栏 */
  const title = useMemo(() => {
    const baseTabId = navStack[0] ?? HOME_TABS[0].id
    return t(TAB_TITLE_KEYS.get(baseTabId) ?? 'tab_discover')
  }, [navStack, t])

  /**
   * 主 Tab 顶栏右侧动作：
   * - 发现页 → 无（搜索框已移到页面内、排行榜上方）。
   * - 我的页 → 设置。
   * - 二级页不显示（那一层已有自己的返回栏，再放全局动作会重复）。
   */
  const headerRight = useMemo(() => {
    if (navStack.length > 1) return undefined
    const baseTabId = navStack[0] ?? HOME_TABS[0].id
    if (baseTabId == 'nav_mine') {
      return (
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('nav_setting')}
          onPress={() => { navigateTo('nav_setting') }}
        >
          <IconMC name="cog-outline" size={20} color={REF_COLOR.textSub} />
        </TouchableOpacity>
      )
    }
    return undefined
  }, [navStack, t])

  useEffect(() => {
    global.lx.homePagerIdle = true
    if (activeIndexRef.current == mainIndex) return
    activeIndexRef.current = mainIndex
    pagerViewRef.current?.setPageWithoutAnimation(mainIndex)
  }, [mainIndex])

  // 二级页第一次打开时挂到图层上；之后一直保留（返回再进不丢状态）
  useEffect(() => {
    if (!secondaryId) return
    setVisitedSecondary(prev => prev.includes(secondaryId) ? prev : [...prev, secondaryId])
  }, [secondaryId])

  /**
   * 滑动落到另一页：同步 JS 状态（底部 Tab 高亮、顶栏标题都从它派生）。
   * Pager 里只有两页，两端都是原生边界，所以这里不需要任何方向拦截。
   */
  const onPageSelected = useCallback(({ nativeEvent }: { nativeEvent: { position: number } }) => {
    const target = nativeEvent.position
    if (target == activeIndexRef.current) return
    const id = MAIN_PAGE_IDS[target]
    if (!id) {
      pagerViewRef.current?.setPageWithoutAnimation(activeIndexRef.current)
      return
    }
    activeIndexRef.current = target
    switchHomeTab(id)
  }, [])

  return (
    <>
      <MainTabHeader title={title} right={headerRight} />
      <View style={styles.content}>
        <PagerView
          ref={pagerViewRef}
          initialPage={activeIndexRef.current}
          offscreenPageLimit={1}
          onPageSelected={onPageSelected}
          // 「我的」页的行正在被触摸时暂停翻页，让行内左滑删除拿到手势；
          // 抬手即恢复，所以滑动切换与左滑删除可以同时存在。
          scrollEnabled={!rowTouching}
          style={styles.pagerView}
        >
          {MAIN_PAGES.map((page, index) => (
            <PageSlot key={page.id} page={page} t={t} active={index === mainIndex} />
          ))}
        </PagerView>
        {/* 二级页画在 Pager 之上：只显示当前那一个，其余保持挂载但不渲染、不接收触摸 */}
        {visitedSecondary.map(id => {
          const page = PAGE_BY_ID.get(id)
          if (!page) return null
          const active = id === secondaryId
          return (
            <View
              key={id}
              /**
               * 必须自己铺底色：二级页（设置 / 搜索 / 歌单…）自身不画背景，
               * 以前它们是 Pager 的当前页、后面什么都没有；现在画在 Pager 之上，
               * 不铺底色就会把下面的「发现 / 我的」透出来（实测）。
               */
              style={active
                ? [styles.layer, { backgroundColor: theme['c-content-background'] }]
                : styles.layerHidden}
              pointerEvents={active ? 'auto' : 'none'}
            >
              <PageBody page={page} t={t} />
            </View>
          )
        })}
      </View>
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
    /**
     * 兜底：RN Navigation 里还压着独立屏幕（播放页 / 评论页）时，返回键绝不能
     * 直接退到桌面。
     *
     * 正常情况下上面那几屏自己的 `useBackHandler` 会先消费掉（最后注册的先执行），
     * 这里只在它们都没接住时收尾 —— 实测 JS 线程被长任务卡住（评论页首屏
     * 一次性挂几千条评论）时，返回事件会延迟送达甚至落到空处，主界面若直接
     * `return false`，系统就把整个 Task 关掉了。
     */
    const ids = commonState.componentIds
    const topScreen = ids.comment ?? ids.songlistDetail ?? ids.playDetail
    if (topScreen) {
      void pop(topScreen)
      return true
    }
    return false // 放行给系统（退出应用）
  }, []))

  return <TabPages activeId={activeId} />
})

const styles = createStyle({
  content: {
    flex: 1,
  },
  pagerView: {
    flex: 1,
    overflow: 'hidden',
  },
  /** 二级页图层：铺满 Pager 之外的同一块区域 */
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  /** 非当前二级页：留在树上（不丢状态）但不显示、不接收触摸 */
  layerHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
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
