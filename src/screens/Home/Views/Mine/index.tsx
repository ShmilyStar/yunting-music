import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongThumb from '@/components/common/SongThumb'
import SwipeRow, { closeAllSwipeRows } from '@/components/common/SwipeRow'
import LocalMusic, { LocalMusicHeaderBtn } from '../LocalMusic'
import RecentPlay from '../RecentPlay'
import { MINE_SECTIONS, type MineSectionId } from '@/config/homeTabs'
import { usePageLayout } from '../../components/pageLayout'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS } from '@/config/constant'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { navigateTo } from '@/core/common'
import { getListMusics, removeUserList, setActiveList } from '@/core/list'
import { getPicPath } from '@/core/music'
import { getListDetail } from '@/core/songlist'
import { playList } from '@/core/player/player'
import { clearRecentPlay, initRecentPlay } from '@/core/recentPlay'
import { useMyList } from '@/store/list/hook'
import { useRecentPlay } from '@/store/recentPlay/hook'
import { useIsTabletLayout, useWindowSize } from '@/utils/hooks'

/** 长列表统一虚拟化参数 */
const LIST_PERF = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 6,
  windowSize: 7,
  removeClippedSubviews: true,
} as const

/**
 * `sourceListId` 存的是 `<源>__<歌单id>`（如 `kg__id_7058359`），
 * 各音乐源接口要的是后段（`id_7058359`）。
 */
const stripListIdPrefix = (sourceListId: string) => {
  const index = sourceListId.indexOf('__')
  return index < 0 ? sourceListId : sourceListId.slice(index + 2)
}

interface MineListRow {
  id: string
  name: string
  count?: number
  pic?: string | null
  isLove: boolean
}

/** 歌单行：副标题可选（「我的收藏」目录行用来显示曲目数） */
const ListItem = memo(({ id, name, subtitle, pic, onPress }: {
  id: string
  name: string
  subtitle?: string
  pic?: string | null
  onPress: (id: string) => void
}) => (
  <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => { onPress(id) }}>
    <View style={styles.rowMain}>
      <SongThumb size={42} pic={pic ?? null} rounded={8} placeholderIcon="playlist-music" />
      <View style={styles.rowInfo}>
        <Text size={14} numberOfLines={1} color={REF_COLOR.text}>{name}</Text>
        {subtitle ? (
          <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.rowSub}>{subtitle}</Text>
        ) : null}
      </View>
      <IconMC name="chevron-right" size={18} color={REF_COLOR.textHint} />
    </View>
  </TouchableOpacity>
))

/**
 * 我的：四宫格（我的歌曲 / 我的歌单 / 本地歌曲 / 最近播放）+ 小标题栏 + 结果列表。
 *
 * 四个入口都是**页内分段**：点击只切换下方内容，不再跳转二级页；
 * 小标题栏显示当前分段（歌曲 / 歌单 / 本地歌曲 / 最近播放），默认歌曲。
 * 「本地歌曲」进入目录后用标题栏的返回箭头回到上一层。
 */
export default memo(() => {
  const t = useI18n()
  const isTablet = useIsTabletLayout()
  const pageLayout = usePageLayout(useWindowSize().width)
  const [section, setSection] = useState<MineSectionId>('song')
  const [musics, setMusics] = useState<LX.Music.MusicInfo[]>([])
  const [localNav, setLocalNav] = useState<{ title: string, canGoBack: boolean }>({ title: '', canGoBack: false })
  const [localHeaderAction, setLocalHeaderAction] = useState<{ action: 'addDir' | 'scan', seq: number } | null>(null)
  const [localBackSeq, setLocalBackSeq] = useState(0)
  /** 重复点「本地歌曲」时自增，页面据此回到初始目录列表（见 handleGridPress） */
  const [localResetSeq, setLocalResetSeq] = useState(0)
  const localResetSeqRef = useRef(0)
  const localActionSeqRef = useRef(0)
  const localBackSeqRef = useRef(0)
  const recentList = useRecentPlay()

  const loadMusics = useCallback(() => {
    void getListMusics(LIST_IDS.LOVE).then(list => { setMusics([...list]) })
  }, [])

  useEffect(() => {
    loadMusics()
    const handleUpdate = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.LOVE)) return
      loadMusics()
    }
    global.app_event.on('myListMusicUpdate', handleUpdate)
    global.state_event.on('mylistUpdated', loadMusics)
    return () => {
      global.app_event.off('myListMusicUpdate', handleUpdate)
      global.state_event.off('mylistUpdated', loadMusics)
    }
  }, [loadMusics])

  // 四宫格与标题栏要显示最近播放数量：先读一次盘（幂等，最近播放页挂载时不会重复读）
  useEffect(() => {
    void initRecentPlay().catch(() => {})
  }, [])

  // 用 useMyList() 订阅：listState.allList 是可变 store，写死依赖的 useMemo
  // 会让新建 / 删除 / 重命名歌单后这里永不刷新（Home 页常驻，不会重挂载）
  const allList = useMyList()
  const userLists = useMemo(
    () => allList.filter(list => list.id != LIST_IDS.DEFAULT && list.id != LIST_IDS.LOVE),
    [allList],
  )

  /**
   * 歌单缩略图：从发现页收藏来的歌单用**同一张歌单封面**；自己新建的列表
   * 用组内第一首有封面的歌（新建项没有在线歌单可查）。
   */
  const [listPics, setListPics] = useState<Record<string, string | null>>({})
  useEffect(() => {
    let cancelled = false
    const build = async() => {
      const next: Record<string, string | null> = {}
      for (const list of userLists) {
        const sourceId = (list as { sourceListId?: string }).sourceListId
        const source = (list as { source?: LX.OnlineSource }).source
        let pic: string | null = null
        if (source && sourceId) {
          pic = await getListDetail(stripListIdPrefix(sourceId), source, 1)
            .then(detail => detail.info.img ?? null)
            .catch(() => null)
        }
        if (!pic) {
          const listMusics = await getListMusics(list.id).catch(() => [] as LX.Music.MusicInfo[])
          for (const music of listMusics.slice(0, 3)) {
            if (music.meta.picUrl) {
              pic = music.meta.picUrl
              break
            }
            const path = await getPicPath({ musicInfo: music, listId: list.id }).catch(() => null)
            if (path) {
              pic = path
              break
            }
          }
        }
        next[list.id] = pic
      }
      if (!cancelled) setListPics(next)
    }
    void build()
    return () => { cancelled = true }
  }, [userLists])

  /** 「我的收藏」目录：把收藏的歌曲收纳到一条目录行里 */
  const lovePic = useMemo(
    () => musics.find(music => music.meta.picUrl)?.meta.picUrl ?? null,
    [musics],
  )

  /**
   * 歌单段只放「从发现页收藏来的歌单」；自己新建的列表在歌曲段「我的收藏」下面。
   * 两段的分法只按 `sourceListId` 判定，计数与列表**必须用同一份过滤结果**。
   */
  const collectedLists = useMemo(
    () => userLists.filter(list => !!(list as { sourceListId?: string }).sourceListId),
    [userLists],
  )
  const createdLists = useMemo(
    () => userLists.filter(list => !(list as { sourceListId?: string }).sourceListId),
    [userLists],
  )

  const counts = useMemo<Record<string, number>>(() => ({
    song: musics.length,
    /**
     * 「我的歌单」计数 = **歌单段里真实渲染出来的行数**。
     *
     * 以前用的是 `userLists.length`，把自己新建的列表也算了进去，
     * 而列表里并不显示它们（它们在歌曲段），于是数字比看到的多
     * （用户 2026-10-21 反馈「把我的歌曲下面的歌单也计算了」）。
     */
    songlist: collectedLists.length,
  }), [musics.length, collectedLists.length])

  const handleListPress = useCallback((id: string) => {
    setActiveList(id)
    navigateTo('nav_love')
  }, [])

  /** 点「我的收藏」目录：直接播收藏列表的第一首，并进入「我的歌单」页 */
  const handleLoveRowPress = useCallback(() => {
    if (musics.length) void playList(LIST_IDS.LOVE, 0)
    setActiveList(LIST_IDS.LOVE)
    navigateTo('nav_love')
  }, [musics.length])

  /** 左滑「取消收藏」：歌单行对应的是删除该自建歌单（不再弹确认） */
  const handleUncollectList = useCallback((id: string) => {
    void removeUserList([id])
  }, [])

  /**
   * 「我的收藏」目录行：放在**歌曲段**的最上方，把收藏的歌曲收纳进这一条目录里。
   * 歌单段仍然是自建歌单本身。
   */
  const loveRow: MineListRow = useMemo(() => ({
    id: LIST_IDS.LOVE,
    name: t('list_name_love'),
    count: musics.length,
    pic: lovePic,
    isLove: true,
  }), [lovePic, musics.length, t])

  /**
   * 点四宫格：只切换页内分段，四个入口都不再跳转二级页。
   *
   * 本地歌曲特例（用户 2026-10-22 要求）：已经停在本段、并且正处在
   * 「已下载 / 我的导入 / 自己添加的目录」的任意一层子目录里时，再点一次
   * 「本地歌曲」应该**回到初始的目录列表**，而不是毫无反应。
   * 用自增的 `localResetSeq` 通知页面清空浏览栈（同段内 `setSection` 不会变化，
   * 页面里 `active` 也就不会从 false 变 true，靠它自己的 useEffect 复位不了）。
   */
  const handleGridPress = useCallback((id: MineSectionId) => {
    closeAllSwipeRows()
    if (id === 'local' && section === 'local') {
      localResetSeqRef.current += 1
      setLocalResetSeq(localResetSeqRef.current)
    }
    setSection(id)
  }, [section])

  /** 本地歌曲标题栏右侧菜单（添加目录 / 扫描） */
  const handleLocalHeaderPress = useCallback((action: 'addDir' | 'scan') => {
    localActionSeqRef.current += 1
    setLocalHeaderAction({ action, seq: localActionSeqRef.current })
  }, [])

  /** 本地歌曲进入子目录后，标题栏返回上一层 */
  const handleLocalBack = useCallback(() => {
    localBackSeqRef.current += 1
    setLocalBackSeq(localBackSeqRef.current)
  }, [])

  /** 最近播放的「清空」已上移到小标题栏，确认逻辑跟原来一致 */
  const handleClearRecent = useCallback(() => {
    void confirmDialog({ message: t('recent_clear_tip') }).then((confirm) => {
      if (confirm) void clearRecentPlay()
    })
  }, [t])

  /** 小标题栏文案：歌曲 / 歌单 / 最近播放带数量，本地歌曲显示当前目录名 */
  const sectionTitle = useMemo(() => {
    switch (section) {
      case 'song':
        return `${t('search_type_music')} · ${musics.length}`
      case 'songlist':
        // 与四宫格同理：这里统计的是歌单段真实渲染的行数
        return `${t('search_type_songlist')} · ${collectedLists.length}`
      case 'recent':
        return `${t('hall_recent')} · ${recentList.length}`
      case 'local':
        return localNav.title || t('hall_local_music')
    }
  }, [collectedLists.length, localNav.title, musics.length, recentList.length, section, t])

  /**
   * 宫格尺寸按发现页「手机 → 平板」的放大倍率同步换算。
   *
   * 发现页卡片手机约 76dp、平板横屏约 119dp，放大约 1.5 倍，字号 12→13；
   * 这里的图标 48dp → 72dp、标签 12→13、数量 11 不变，形状手机圆角方块、
   * 平板圆形，跟发现页一样只放大内容、不整体缩放页面。
   */
  const round = isTablet
  const gridIconSize = isTablet ? 72 : 48
  const gridLabelSize = isTablet ? 13 : 12
  const gridCountSize = 11
  const gridGlyphSize = isTablet ? 36 : 24

  /** 顶部：四宫格 + 小标题栏；搜索与设置入口已移到顶栏右侧图标 */
  const mineHeader = useMemo(() => (
    <View
      style={[
        styles.header,
        pageLayout.width != null && { width: pageLayout.width, alignSelf: 'center' },
        pageLayout.padding > 0 && { paddingHorizontal: pageLayout.padding },
      ]}
      /**
       * 点顶部区域收起滑开的行。
       *
       * **不要把它挂到整页根容器上**：根容器的 `onTouchStart` 会连
       * 「点在左滑露出的操作按钮上」也一起触发，`close()` 里的
       * `scrollTo({ animated: true })` 会在 iOS 上打断这次触摸，
       * 于是「取消收藏」点了没反应（用户 2026-10-21 反馈）。
       */
      onTouchStart={closeAllSwipeRows}
    >
      {/* 四宫格：平板 72dp 圆形，手机 48dp 圆角方块 */}
      <View style={styles.gridRow}>
        {MINE_SECTIONS.map(item => {
          const accent = REF_ACCENT[item.accent]
          const active = item.id == section
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.gridItem}
              activeOpacity={0.7}
              onPress={() => { handleGridPress(item.id) }}
            >
              <View style={{
                ...styles.gridIcon,
                width: gridIconSize,
                height: gridIconSize,
                borderRadius: round ? gridIconSize / 2 : 12,
                backgroundColor: accent.bg,
                borderWidth: 2,
                borderColor: active ? accent.color : 'transparent',
              }}>
                <IconMC name={item.icon} size={gridGlyphSize} color={accent.color} />
              </View>
              <Text
                size={gridLabelSize}
                color={active ? accent.color : REF_COLOR.text}
                style={styles.gridLabel}
                numberOfLines={1}
              >
                {t(item.labelKey)}
              </Text>
              <Text size={gridCountSize} color={REF_COLOR.textHint} style={styles.gridCount} numberOfLines={1}>
                {item.id == 'recent'
                  ? `${recentList.length} ${t('mine_count_unit')}`
                  : item.id == 'local'
                    ? t(item.unitKey)
                    : `${counts[item.id]} ${t(item.unitKey)}`}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 小标题栏：显示当前分段；本地歌曲进入目录后带返回箭头与目录菜单 */}
      <View style={styles.sectionBar}>
        {section == 'local' && localNav.canGoBack
          ? (
              <TouchableOpacity style={styles.sectionBack} activeOpacity={0.7} onPress={handleLocalBack}>
                <IconMC name="chevron-left" size={22} color={REF_COLOR.text} />
              </TouchableOpacity>
            )
          : null}
        <View style={styles.sectionAccent} />
        <Text size={15} color={REF_COLOR.text} numberOfLines={1} style={styles.sectionTitle}>{sectionTitle}</Text>
        <View style={styles.sectionSpacer} />
        {section == 'local' ? <LocalMusicHeaderBtn compact onPress={handleLocalHeaderPress} /> : null}
        {section == 'recent'
          ? (
              <TouchableOpacity style={styles.clearBtn} activeOpacity={0.6} onPress={handleClearRecent}>
                <IconMC name="trash-can-outline" size={15} color={REF_COLOR.textHint} />
                <Text size={13} color={REF_COLOR.textHint} style={styles.clearText}>{t('recent_clear')}</Text>
              </TouchableOpacity>
            )
          : null}
      </View>
    </View>
  ), [
    counts,
    gridCountSize,
    gridGlyphSize,
    gridIconSize,
    gridLabelSize,
    handleClearRecent,
    handleGridPress,
    handleLocalBack,
    handleLocalHeaderPress,
    localNav.canGoBack,
    pageLayout.padding,
    pageLayout.width,
    recentList.length,
    round,
    section,
    sectionTitle,
    t,
  ])

  const renderList = useCallback(({ item }: { item: MineListRow }) => {
    const row = (
      <ListItem
        id={item.id}
        name={item.name}
        subtitle={item.count == null ? undefined : `${item.count} ${t('mine_count_unit')}`}
        pic={item.isLove ? item.pic : (listPics[item.id] ?? item.pic)}
        onPress={item.isLove ? handleLoveRowPress : handleListPress}
      />
    )
    // 「我的收藏」是固定目录，不对它做左滑（它是内置列表，删不掉）
    if (item.isLove) return row
    return (
      <SwipeRow
        actions={[{
          text: t('mine_uncollect'),
          onPress: () => { handleUncollectList(item.id) },
        }]}
      >
        {row}
      </SwipeRow>
    )
  }, [handleListPress, handleLoveRowPress, handleUncollectList, listPics, t])

  /**
   * 双列单元格：`numColumns > 1` 时 RN 只负责分行、**不给宽度**，
   * 行内容（`SwipeRow`）会按自身样式吃满整行 → 两列会重叠。
   * 统一套一层等宽单元格（与「本地歌曲」的做法一致）。
   */
  const renderCell = useCallback((info: ListRenderItemInfo<MineListRow>) => {
    const content = renderList({ item: info.item })
    if (!isTablet) return content
    return <View style={styles.cell}>{content}</View>
  }, [isTablet, renderList])

  // 歌单段只放「从发现页收藏来的歌单」；自己新建的列表在歌曲段「我的收藏」下面
  const songlistRows: MineListRow[] = collectedLists
    .map(list => ({
      id: list.id,
      name: list.name,
      pic: listPics[list.id],
      isLove: false,
    }))
  // 歌曲段：第一行固定是「我的收藏」目录，其后是用户新建的列表
  // （从「发现 → 歌单」收藏来的歌单不算，它们归在歌单段）
  const songRows: MineListRow[] = [
    loveRow,
    ...createdLists
      .map(list => ({ id: list.id, name: list.name, pic: listPics[list.id], isLove: false })),
  ]
  const isSonglist = section == 'songlist'
  const rows = isSonglist ? songlistRows : songRows
  const emptyText = isSonglist ? t('mine_empty_songlist') : null

  /**
   * 结构：四宫格 + 小标题栏固定在上方，下面按分段渲染内容。
   *
   * - 歌曲 / 歌单：列表行（保留原来的「我的收藏」目录与自建歌单）；
   * - 本地歌曲 / 最近播放：直接嵌在下方，不再跳转独立页面。
   *
   * 手机与平板共用这一套。平板按发现页的放大倍率把宫格图标放大到 72dp 圆形，
   * 并由 `pageLayout.padding` 给内容留出左右边距，不整体缩放界面。
   */
  return (
    <View style={styles.container}>
      {mineHeader}
      {section == 'local'
        ? (
            <LocalMusic
              active
              embedded
              headerAction={localHeaderAction}
              onNavChange={setLocalNav}
              backSeq={localBackSeq}
              resetSeq={localResetSeq}
            />
          )
        : section == 'recent'
          ? <RecentPlay />
          : (
              <FlatList
                // 平板改双列后必须换 key 重建列表，否则 RN 会沿用旧的单列测量
                key={isTablet ? 'mine-grid-2' : 'mine-grid-1'}
                style={styles.list}
                numColumns={isTablet ? 2 : 1}
                columnWrapperStyle={isTablet ? styles.column : undefined}
                contentContainerStyle={[
                  styles.content,
                  pageLayout.width != null && { width: pageLayout.width, alignSelf: 'center' },
                  pageLayout.padding > 0 && { paddingHorizontal: pageLayout.padding },
                ]}
                keyboardShouldPersistTaps="handled"
                data={rows}
                renderItem={renderCell}
                keyExtractor={item => item.id}
                ListEmptyComponent={emptyText ? (
                  <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{emptyText}</Text>
                ) : null}
                {...LIST_PERF}
              />
            )}
    </View>
  )
})

const styles = createStyle({
  container: { flex: 1 },
  header: {},
  list: { flex: 1 },
  content: { paddingBottom: 20, paddingTop: 4 },
  /** 平板双列：行容器（列间距）与等宽单元格 */
  column: { gap: 10 },
  /**
   * `maxWidth: '50%'`：`numColumns` 每行里只有一个条目时（例如只有 1 个收藏歌单），
   * 它会被拉成整行，看起来又不像双列了 —— 卡住半宽，两个分段的行宽始终一致。
   */
  cell: { flex: 1, maxWidth: '50%', minWidth: 0, overflow: 'hidden' },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingTop: 4,
    // 底边不再留白：小标题栏自己带上下留白，双份留白会让中间空一大块
    paddingBottom: 0,
  },
  gridItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    paddingVertical: 4,
  },
  gridIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    marginTop: 4,
  },
  /** 平板：图标变大后文字贴紧一点，避免整块过高 */
  gridLabelTablet: {
    marginTop: 2,
  },
  gridCount: {
    marginTop: 1,
  },
  /** 四宫格下面的小标题栏：绿色竖条 + 当前分段名 +（本地歌曲）目录菜单 */
  sectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingLeft: 12,
    paddingRight: 12,
  },
  sectionBack: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
    marginRight: 2,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
    backgroundColor: REF_COLOR.primary,
  },
  sectionTitle: {
    flexShrink: 1,
    fontWeight: '600',
  },
  sectionSpacer: {
    flexGrow: 1,
    flexShrink: 0,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: 8,
  },
  clearText: {
    marginLeft: 4,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 8,
  },
  rowInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  rowSub: {
    marginTop: 3,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
})
