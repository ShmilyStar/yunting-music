import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SectionHeader from '../../components/SectionHeader'
import CardRow, { type CardItem } from '../../components/CardRow'
import SourceSwitch from '../../components/SourceSwitch'
import { getBoardAccent, getBoardIcon } from '../../components/boardIcon'
import { DISCOVER_QUICK_ENTRIES } from '@/config/homeTabs'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { MUSIC_TOGGLE_MODE } from '@/config/constant'
import { createStyle, toast } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useI18n } from '@/lang'
import { navigateTo, updateSetting } from '@/core/common'
import { getBoardsList, setActiveBoardName } from '@/core/leaderboard'
import { getList, getSortList } from '@/core/songlist'
import music from '@/utils/musicSdk'
import { playList } from '@/core/player/player'
import { getListMusics } from '@/core/list'
import { getLeaderboardSetting, getSongListSetting, saveLeaderboardSetting, saveSongListSetting } from '@/utils/data'
import leaderboardState from '@/store/leaderboard/state'
import songlistState from '@/store/songlist/state'
import listState from '@/store/list/state'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { type ListInfoItem } from '@/store/songlist/state'

const MAX_CARDS = 8

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

/** 发现页：四快捷入口 + 排行榜（横滑卡片）+ 歌单（折行网格） */
export default memo(() => {
  const t = useI18n()
  const [boardSource, setBoardSource] = useState<LX.OnlineSource>('kw')
  const [listSource, setListSource] = useState<LX.OnlineSource>('kw')
  const [boards, setBoards] = useState<CardItem[]>([])
  const [songlists, setSonglists] = useState<CardItem[]>([])
  const [songlistRaw, setSonglistRaw] = useState<ListInfoItem[]>([])

  const loadBoards = useCallback(async(source: LX.OnlineSource) => {
    try {
      const list = await getBoardsList(source)
      setBoards(list.slice(0, MAX_CARDS).map(item => ({
        id: `${source}__${item.id}`,
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
    navigateTo('nav_top')
  }, [boardSource])

  const handleSonglistPress = useCallback((item: CardItem) => {
    const info = songlistRaw.find(s => s.id === item.id)
    if (!info) return
    const componentId = commonState.componentIds.home
    if (componentId) navigations.pushSonglistDetailScreen(componentId, info)
  }, [songlistRaw])

  const handleQuickEntry = useCallback(async(id: typeof DISCOVER_QUICK_ENTRIES[number]['id']) => {
    switch (id) {
      case 'love':
        navigateTo('nav_love')
        break
      case 'recent':
        navigateTo('nav_recent')
        break
      case 'search':
        navigateTo('nav_search')
        break
      default: {
        // 随机播放：从所有本地列表里随机抽一首
        const lists = listState.allList
        const pool: Array<{ listId: string, index: number }> = []
        for (const list of lists) {
          const musics = await getListMusics(list.id)
          musics.forEach((_, index) => { pool.push({ listId: list.id, index }) })
        }
        if (!pool.length) {
          toast(t('discover_no_music_tip'))
          return
        }
        const target = pool[Math.floor(Math.random() * pool.length)]
        updateSetting({ 'player.togglePlayMethod': MUSIC_TOGGLE_MODE.random })
        void playList(target.listId, target.index)
        break
      }
    }
  }, [t])

  const sourceList = useMemo(() => leaderboardState.sources, [])
  const listSourceList = useMemo(() => songlistState.sources, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ② 快捷入口 */}
      <View style={styles.quickRow}>
        {DISCOVER_QUICK_ENTRIES.map(entry => {
          const accent = REF_ACCENT[entry.accent]
          return (
            <TouchableOpacity
              key={entry.id}
              style={styles.quickItem}
              activeOpacity={0.7}
              onPress={() => { void handleQuickEntry(entry.id) }}
            >
              <View style={{ ...styles.quickIcon, backgroundColor: accent.bg }}>
                <IconMC name={entry.icon} size={26} color={accent.color} />
              </View>
              <Text size={12} color={REF_COLOR.textSub} style={styles.quickLabel} numberOfLines={1}>{t(entry.labelKey)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ③ 排行榜 */}
      <SectionHeader
        title={t('discover_leaderboard')}
        right={<SourceSwitch sources={sourceList} active={boardSource} onSelect={handleChangeBoardSource} />}
        showMore
        onMore={() => { navigateTo('nav_top') }}
      />
      {boards.length
        ? <CardRow data={boards} mode="scroll" onPress={handleBoardPress} />
        : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>}

      {/* ④ 歌单 */}
      <SectionHeader
        title={t('discover_songlist')}
        right={<SourceSwitch sources={listSourceList} active={listSource} onSelect={handleChangeListSource} />}
        showMore
        onMore={() => { navigateTo('nav_songlist') }}
      />
      {songlists.length
        ? <CardRow data={songlists} mode="wrap" onPress={handleSonglistPress} />
        : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>}
    </ScrollView>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 6,
  },
  quickItem: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
  },
  quickIcon: {
    width: 54,
    height: 54,
    borderRadius: scaleSizeW(27),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    marginTop: 7,
  },
  empty: {
    paddingLeft: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
})
