import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SectionHeader, { SECTION_HEADER_COMPACT_BASE } from '../../components/SectionHeader'
import CardRow, { type CardItem } from '../../components/CardRow'
import SourceSwitch from '../../components/SourceSwitch'
import { getBoardAccent, getBoardIcon } from '../../components/boardIcon'
import { REF_COLOR } from '@/config/uiPalette'
import { usePageLayout } from '../../components/pageLayout'
import { createStyle } from '@/utils/tools'
import { scaleSizeW, scaleSizeH, setSpText } from '@/utils/pixelRatio'
import { useWindowSize } from '@/utils/hooks'
import { useI18n } from '@/lang'
import { navigateTo } from '@/core/common'
import { getBoardsList, setActiveBoardName } from '@/core/leaderboard'
import { getList, getSortList } from '@/core/songlist'
import music from '@/utils/musicSdk'
import { getLeaderboardSetting, getSongListSetting, saveLeaderboardSetting, saveSongListSetting } from '@/utils/data'
import leaderboardState from '@/store/leaderboard/state'
import songlistState from '@/store/songlist/state'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { type ListInfoItem } from '@/store/songlist/state'
import { useTheme } from '@/store/theme/hook'

const MAX_CARDS = 12
/**
 * 卡片文字区高度（设计值，会经 `setSpText` 随字号缩放）。
 *
 * **按实测反推**（2026-10-21，720×1612@320、字体「大」）：
 *   封面行步进 241px = 120.5dp，其中封面 78dp → 文字区实际 42.5dp。
 * 文字区包含：名称行（`lineHeight: 16`）+ 间距 + 副标题行 + 首行上边距。
 * 把它折算成「设计值 × 缩放」后需要 ~33 的设计值总量（42.5 ÷ 1.265），
 * 而此前按「名称 16 + 副标题 12 + 间距 4 = 32」估的偏小，
 * 导致 3 行判断过松、最后一行被 mini 条裁掉。现取 34 并另加 `ROW_SAFETY` 余量。
 */
const CARD_TEXT_BASE = 22
const CARD_SUB_BASE = 14
const CARD_TEXT_GAP = 4
/**
 * 行数判断的安全余量（设计值）：向上取整、行距取整都会累积误差，
 * 宁可少排一行，也不要让第一屏出现半张卡片。
 */
const ROW_SAFETY = 8
/**
 * 一屏放得下时，封面最小可读尺寸；再小就宁可滚动也不把卡片压扁。
 *
 * 注意：「能不能多排一行」只看真实占位，不用这个下限放宽条件；
 * 它只是「允许把封面收小到多少」的下限。
 */
const MIN_FIT_CARD_WIDTH = 72
/**
 * 取该源「默认排序 id」：优先用已保存的（同一源才认），否则用 SDK 静态排序表的第一项，
 * 再退回 store 里的排序表。各源排序 id 不同（kg/kw 是字符串、QQ 是 -1/3/2），
 * 传错会让歌单接口返回空列表。
 */
const getDefaultSortId = (source: LX.OnlineSource, savedSortId: string) => {
  if (savedSortId) return savedSortId
  const staticSortId = music[source]?.songList?.sortList?.[0]?.id
  if (staticSortId) return String(staticSortId)
  return getSortList(source)?.[0]?.id ?? ''
}

/**
 * 发现页内搜索条：整行通栏，点击进入搜索页。
 *
 * 只做入口，不在这里直接过滤：搜索页有来源切换、联想、历史与歌曲/歌单分类，
 * 在发现页再实现一套输入逻辑会与搜索页状态打架。
 */
const DiscoverSearchBar = memo(() => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <TouchableOpacity
      style={[styles.searchBar, {
        backgroundColor: theme['c-primary-input-background'],
        borderColor: theme['c-border-background'],
      }]}
      activeOpacity={0.7}
      onPress={() => { navigateTo('nav_search') }}
    >
      <IconMC name="magnify" size={17} color={theme['c-font-label']} />
      <Text size={13} color={REF_COLOR.textHint} numberOfLines={1} style={styles.searchText}>
        {t('discover_search_placeholder')}
      </Text>
    </TouchableOpacity>
  )
})

/**
 * 发现页：排行榜（横滑一行）+ 歌单（横屏一排 8 个、手机/竖屏两行四列）。
 *
 * 高屏一屏放完：封面边长由「可用高度 ÷ 行数」反推，榜单和歌单共用同一个封面尺寸，
 * 保证两段在同一屏内、最下面一行正好落在 mini 条上方；矮屏（如手机横屏 640×360dp）
 * 放不下时自动改为上下滚动，搜索条固定在顶部不随内容滚走。
 */
export default memo(() => {
  const t = useI18n()
  const windowSize = useWindowSize()
  const pageLayout = usePageLayout(windowSize.width)
  const [boardSource, setBoardSource] = useState<LX.OnlineSource>('kw')
  const [listSource, setListSource] = useState<LX.OnlineSource>('kw')
  const [boards, setBoards] = useState<CardItem[]>([])
  const [songlists, setSonglists] = useState<CardItem[]>([])
  const [songlistRaw, setSonglistRaw] = useState<ListInfoItem[]>([])
  /** 发现页实际可用高度（studio 条以上），onLayout 后才有值 */
  const [areaHeight, setAreaHeight] = useState(0)

  const loadBoards = useCallback(async(source: LX.OnlineSource) => {
    try {
      const list = await getBoardsList(source)
      setBoards(list.slice(0, MAX_CARDS).map(item => ({
        /**
         * 榜单 id **不要自己再拼一遍源前缀**。
         *
         * SDK 返回的 `item.id` 本身已经是 `{source}__{bangId}` 形式
         * （如 `kw__93`，见 `utils/musicSdk/kw/leaderboard.js` 的 boardList）。
         * 以前这里写成 `${source}__${item.id}`，会拼出 `kw__kw__93`：
         * `getListDetailAll` 按 `__` 切分后拿到 `bangId = 'kw__93'`，
         * 传给榜单接口就是一个不存在的 id，表现为「点了榜单跳过去内容不对/为空」。
         */
        id: item.id,
        name: item.name,
        icon: getBoardIcon(item.name),
        accent: getBoardAccent(item.name, list.length),
      })))
    } catch {
      setBoards([])
    }
  }, [])

  const loadSonglists = useCallback(async(source: LX.OnlineSource) => {
    try {
      const setting = await getSongListSetting()
      // sortId 必须落在该源自己的排序表里：各源排序 id 不同（如 QQ 是 -1/3/2），
      // 取不到时传空串或别家的 id 都会让接口返回空列表。
      // store 里的排序表要访问过歌单页才有，所以这里优先读 SDK 的静态排序表。
      const sortId = getDefaultSortId(source, setting.source == source ? setting.sortId : '')
      const res = await getList(source, '', sortId, 1)
      setSonglistRaw(res.list)
      setSonglists(res.list.slice(0, MAX_CARDS).map(item => ({
        id: item.id,
        name: item.name,
        sub: item.author,
        pic: item.img,
      })))
    } catch {
      setSonglistRaw([])
      setSonglists([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const init = async() => {
      const [boardSetting, listSetting] = await Promise.all([getLeaderboardSetting(), getSongListSetting()])
      if (cancelled) return
      setBoardSource(boardSetting.source)
      setListSource(listSetting.source)
      void loadBoards(boardSetting.source)
      void loadSonglists(listSetting.source)
    }
    void init()
    return () => { cancelled = true }
  }, [loadBoards, loadSonglists])

  const handleChangeBoardSource = useCallback((source: LX.OnlineSource) => {
    setBoardSource(source)
    void saveLeaderboardSetting({ source })
    void loadBoards(source)
  }, [loadBoards])

  const handleChangeListSource = useCallback((source: LX.OnlineSource) => {
    setListSource(source)
    // 切源时标签与排序跟着源重置（与歌单页一致）：sortId 取该源的首个排序项
    void saveSongListSetting({ source, tagId: '', tagName: '', sortId: getDefaultSortId(source, '') })
    void loadSonglists(source)
  }, [loadSonglists])

  const handleBoardPress = useCallback((item: CardItem) => {
    // 存的是带源前缀的 boardId（与 DEFAULT_SETTING.leaderboard.boardId 同口径）
    void saveLeaderboardSetting({ source: boardSource, boardId: item.id })
    // 榜单歌曲页的标题靠这个字段刷新（它刻意不发事件）
    setActiveBoardName(item.name)
    /**
     * 跳到**榜单歌曲页**，不是排行榜列表页。
     *
     * 这里原来写的是 `navigateTo('nav_top')`，而 `nav_top` 是「排行榜」列表页
     * （全部榜单的索引），所以点具体榜单只会打开那个列表页、看不到这首歌的榜单内容
     * （用户 2026-10-21 反馈「发现页点击具体榜单跳转错误」）。
     * 与 `Leaderboard/index.tsx` 里点榜单行后的跳转保持一致：都是 `nav_board_songs`。
     */
    navigateTo('nav_board_songs')
  }, [boardSource])

  const handleSonglistPress = useCallback((item: CardItem) => {
    const info = songlistRaw.find(s => s.id === item.id)
    if (!info) return
    const componentId = commonState.componentIds.home
    if (componentId) navigations.pushSonglistDetailScreen(componentId, info)
  }, [songlistRaw])

  const sourceList = useMemo(() => leaderboardState.sources, [])
  const listSourceList = useMemo(() => songlistState.sources, [])

  /**
   * 一屏放完的几何：**行数按实际可用高度自动选择**（2 行或 3 行）。
   *
   * 判据是真实占位：
   *   固定开销 = 2 条分组标题 + 卡片行的下间距
   *   每行占位 = 封面边长 + 文字区 + 行间距
   * 从 3 行开始试，放得下就用 3 行（12 个），否则退回 2 行（8 个）；
   * 两行都放不下（超矮屏）就让卡片保持自然宽度、交给 ScrollView 滚动。
   *
   * 全部输入都来自 `scaleSizeW/H` 与 `setSpText`，所以**字号调大时行高会跟着变大、
   * 行数会自动减回去**，不会出现「字大了还被硬塞 3 行、第一屏被裁」的情况。
   *
   * 横屏宽版（手机 / 平板横屏）固定 1 行 8 列，由宽度决定。
   */
  const isLandscape = windowSize.width > windowSize.height
  /** 横屏宽版：手机横屏、平板横屏都排 8 列一行，不再只认平板 */
  const isLandscapeTablet = isLandscape && windowSize.width >= 600
  const columns = isLandscapeTablet ? 8 : (pageLayout.isTablet && windowSize.width >= 700 ? 6 : 4)
  const gap = scaleSizeW(pageLayout.isTablet ? 8 : 10)
  /** 卡片文字区高度：随字号缩放（名称 1 行 + 副标题 1 行 + 两者间距） */
  const cardTextHeight = useMemo(
    () => setSpText(CARD_TEXT_BASE) + setSpText(CARD_SUB_BASE) + scaleSizeH(CARD_TEXT_GAP + ROW_SAFETY),
    [],
  )
  /** 分组标题（compact）实测高度：按 style 里的上下留白推算，平板多 3dp 余量 */
  const headerHeight = scaleSizeH(SECTION_HEADER_COMPACT_BASE + (pageLayout.isTablet ? 3 : 0))
  const measuredHeight = areaHeight || Math.max(300, windowSize.height - 180)

  /**
   * 自然宽度：`columns` 列铺满可用宽度时的卡片边长。
   *
   * 与 `CardRow` 内部算法**保持同一套口径**：同样是「固定列数、卡片向下取整、
   * 余量摊进列间距」。这里只用来判断「一屏能排几行」，最终渲染仍以 CardRow 为准；
   * 两边公式必须一致，否则行数判断与实际排布会打架。
   */
  const gridPadding = scaleSizeW(12) * 2
  const baseGap = Math.round(scaleSizeW(pageLayout.isTablet ? 8 : 10))
  const naturalWidth = Math.max(1, Math.floor(
    (pageLayout.contentWidth - gridPadding - baseGap * (columns - 1)) / columns,
  ))

  // 几何日志只在开发期输出：生产环境每次重渲染都 JSON.stringify 一次是纯浪费
  if (__DEV__) {
    const geom = {
      w: windowSize.width,
      h: windowSize.height,
      areaHeight,
      contentWidth: pageLayout.contentWidth,
      columns,
      gap,
      naturalWidth,
      headerH: headerHeight,
      cardTextH: cardTextHeight,
    }
    console.log('[DISCOVER]', JSON.stringify(geom))
  }

  const { songRows, cardWidth } = useMemo(() => {
    /** 给定行数与卡片宽度，判断是否放得下（榜单恒 1 行） */
    const fits = (rows: number, width: number) => {
      const bandNeed = (1 + rows) * (width + cardTextHeight + gap) + 2 * headerHeight
      return bandNeed <= measuredHeight
    }

    /**
     * 横屏宽版：恒 1 行 8 列（列数由宽度决定，不能动），
     * 高度就只能靠**收小卡片边长**来凑。之前这里直接返回自然宽度，
     * 平板横屏 1600×900 实测「歌单」那一行的名字会被底部 mini 条裁掉 ——
     * 用户反馈「发现页第一屏没显示全，要下滑一点点」。
     */
    if (isLandscapeTablet) {
      if (fits(1, naturalWidth)) return { songRows: 1, cardWidth: naturalWidth }
      const band = measuredHeight - 2 * headerHeight
      const fit = Math.floor(band / 2 - cardTextHeight - gap)
      if (fit >= MIN_FIT_CARD_WIDTH) return { songRows: 1, cardWidth: fit }
      // 再小就压扁了：保持自然宽度，交给 ScrollView 滚动（超矮横屏）
      return { songRows: 1, cardWidth: naturalWidth }
    }

    for (const rows of [3, 2]) {
      // 自然宽度放得下就直接用，不缩小卡片
      if (fits(rows, naturalWidth)) return { songRows: rows, cardWidth: naturalWidth }
      // 放不下时按高度反推能放下的最大边长（不低于可读下限才收小）
      const band = measuredHeight - 2 * headerHeight
      const fit = Math.floor(band / (1 + rows) - cardTextHeight - gap)
      if (fit >= MIN_FIT_CARD_WIDTH && fit < naturalWidth) return { songRows: rows, cardWidth: fit }
    }
    // 两行都塞不下：保持自然宽度，交给 ScrollView 滚动（超矮屏）
    return { songRows: 2, cardWidth: naturalWidth }
  }, [cardTextHeight, gap, headerHeight, isLandscapeTablet, measuredHeight, naturalWidth])

  return (
    <View style={[styles.screen, pageLayout.padding > 0 && { paddingHorizontal: pageLayout.padding }]}>
      {/* 搜索条固定在顶部：短屏（手机横屏）滚动内容时仍能直接搜索 */}
      <DiscoverSearchBar />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height)
          if (next > 0) setAreaHeight(prev => (prev === next ? prev : next))
        }}
      >
        {/* 排行榜：横滑一行，卡片尺寸与歌单完全一致 */}
        <SectionHeader
          title={t('discover_leaderboard')}
          right={<SourceSwitch sources={sourceList} active={boardSource} onSelect={handleChangeBoardSource} />}
          showMore
          compact
          onMore={() => { navigateTo('nav_top') }}
        />
        {boards.length
          ? (
              <CardRow
                data={boards}
                mode="scroll"
                onPress={handleBoardPress}
                availableWidth={pageLayout.contentWidth}
                columns={columns}
                maxWidth={cardWidth}
                oneLine
              />
            )
          : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>}

        {/* 歌单：手机 / 竖屏两行四列，横屏一排 8 个 */}
        <SectionHeader
          title={t('discover_songlist')}
          right={<SourceSwitch sources={listSourceList} active={listSource} onSelect={handleChangeListSource} />}
          showMore
          compact
          onMore={() => { navigateTo('nav_songlist') }}
        />
        {songlists.length
          ? (
              <CardRow
                data={songlists.slice(0, columns * songRows)}
                mode="wrap"
                onPress={handleSonglistPress}
                availableWidth={pageLayout.contentWidth}
                columns={columns}
                maxWidth={cardWidth}
                oneLine
              />
            )
          : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>}
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  screen: {
    flex: 1,
  },
  content: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  searchBar: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
  },
  searchText: {
    flexShrink: 1,
    marginLeft: 6,
  },
  empty: {
    paddingLeft: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
})
