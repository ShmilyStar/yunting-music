import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import ModuleSearchBar from '../../components/ModuleSearchBar'
import SongRow from '../../components/SongRow'
import { REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS, type NAV_ID_Type } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import { getCurrentBoardId, getListDetailAll } from '@/core/leaderboard'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'

export type CategoryMode = 'song' | 'singer' | 'album'

interface AggregateItem {
  name: string
  count: number
}

const MODE_CONF: Record<CategoryMode, {
  navId: NAV_ID_Type
  titleKey: 'hall_song' | 'hall_singer' | 'hall_album'
  /** 写进临时列表时用的列表标识（只作为 meta，实际数据落在 LIST_IDS.TEMP） */
  tempListId: string
}> = {
  song: { navId: 'nav_hot_songs', titleKey: 'hall_song', tempListId: 'category_song__play' },
  singer: { navId: 'nav_singers', titleKey: 'hall_singer', tempListId: 'category_singer__play' },
  album: { navId: 'nav_albums', titleKey: 'hall_album', tempListId: 'category_album__play' },
}

/** 歌手名的分割符：`/、,;，；&`（与「我的」页的聚合算法一致） */
const SINGER_SPLIT_RXP = /[/、,;，；&]/

const splitSingers = (singer: string) => singer.split(SINGER_SPLIT_RXP).map(name => name.trim()).filter(Boolean)

/**
 * 按歌手 / 专辑聚合计数。
 *
 * 同数量的项按**首次出现顺序**排（显式记 order，不依赖 sort 的稳定性）。
 */
const buildAggregate = (mode: CategoryMode, list: LX.Music.MusicInfoOnline[]): AggregateItem[] => {
  const counter = new Map<string, { count: number, order: number }>()
  let order = 0
  for (const item of list) {
    const names = mode == 'album' ? [item.meta.albumName] : splitSingers(item.singer)
    for (const raw of names) {
      const name = raw?.trim?.() ?? ''
      if (!name) continue
      const prev = counter.get(name)
      if (prev) prev.count++
      else counter.set(name, { count: 1, order: order++ })
    }
  }
  return Array.from(counter, ([name, info]) => ({ name, count: info.count, order: info.order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ name, count }) => ({ name, count }))
}

/** 判断一首歌是否属于某个歌手 / 专辑 */
const isInGroup = (mode: CategoryMode, item: LX.Music.MusicInfoOnline, name: string) =>
  mode == 'album' ? item.meta.albumName == name : splitSingers(item.singer).includes(name)

/**
 * 分类列表（03 §9）：一个组件支持 `mode="song" | "singer" | "album"`。
 *
 * 数据源统一取**当前排行榜榜单的全量歌曲**（`getLeaderboardSetting()` +
 * `getListDetailAll()`）——上游没有「按歌手 / 专辑浏览全库」的接口，
 * 这里用榜单数据做聚合源；换数据源时只改 `load()`，UI 不动。
 */
export default memo(({ mode }: { mode: CategoryMode }) => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const playMusicInfo = usePlayMusicInfo()
  const conf = MODE_CONF[mode]
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  /** 已进入的歌手 / 专辑（只有 singer / album 模式会用到） */
  const [filterName, setFilterName] = useState<string | null>(null)

  const load = useCallback(async() => {
    setLoading(true)
    let result: LX.Music.MusicInfoOnline[] = []
    try {
      result = await getListDetailAll(await getCurrentBoardId())
    } catch (err) {
      console.log(err)
    }
    setList(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    // 页面常驻不卸载：每次进入本页都重新取一次当前榜单
    if (activeId != conf.navId) return
    setFilterName(null)
    void load()
  }, [activeId, conf.navId, load])

  const keywordLower = keyword.trim().toLowerCase()
  const matchKeyword = useCallback((...fields: Array<string | null | undefined>) =>
    fields.some(field => field?.toLowerCase().includes(keywordLower)), [keywordLower])

  /** 聚合行（仅 singer / album 模式的未筛选态） */
  const aggregates = useMemo(() => {
    if (mode == 'song' || filterName) return []
    const items = buildAggregate(mode, list)
    return keywordLower ? items.filter(item => item.name.toLowerCase().includes(keywordLower)) : items
  }, [mode, list, filterName, keywordLower])

  /** 歌曲行（song 模式全量 / 进入某歌手或专辑后的筛选结果） */
  const songs = useMemo(() => {
    let items: LX.Music.MusicInfoOnline[]
    if (mode == 'song') items = list
    else if (filterName) items = list.filter(item => isInGroup(mode, item, filterName))
    else items = []
    return keywordLower
      ? items.filter(item => matchKeyword(item.name, item.singer, item.meta.albumName))
      : items
  }, [mode, list, filterName, keywordLower, matchKeyword])

  const currentId = playMusicInfo.musicInfo?.id

  const handlePlay = useCallback((index: number) => {
    if (!songs.length) return
    // 先落临时列表再播，保证播放队列与页面看到的一致
    void setTempList(conf.tempListId, [...songs]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [songs, conf.tempListId])

  const renderSong = useCallback(({ item, index }: { item: LX.Music.MusicInfoOnline, index: number }) => (
    <SongRow
      index={index + 1}
      name={item.name}
      singer={item.singer}
      album={item.meta.albumName}
      pic={item.meta.picUrl}
      musicInfo={item}
      active={item.id == currentId}
      onPress={() => { handlePlay(index) }}
    />
  ), [currentId, handlePlay])

  const renderAggregate = useCallback(({ item }: { item: AggregateItem }) => (
    <TouchableOpacity style={styles.aggregateRow} activeOpacity={0.7} onPress={() => { setFilterName(item.name) }}>
      <Text size={14} numberOfLines={1} color={REF_COLOR.text} style={styles.aggregateName}>{item.name}</Text>
      <Text size={11} color={REF_COLOR.textHint}>{`${item.count} ${t('mine_count_unit')}`}</Text>
      <IconMC name="chevron-right" size={18} color={REF_COLOR.textHint} style={styles.aggregateArrow} />
    </TouchableOpacity>
  ), [t])

  const showAggregates = mode != 'song' && filterName == null
  const isEmpty = showAggregates ? !aggregates.length : !songs.length

  return (
    <View style={styles.container}>
      <ModuleSearchBar
        placeholder={t('module_search_tip', { name: t(conf.titleKey) })}
        value={keyword}
        onChangeText={setKeyword}
      />

      {/* 进入某歌手 / 专辑后出现筛选条，点击清除筛选 */}
      {filterName
        ? (
            <TouchableOpacity style={styles.filterBar} activeOpacity={0.7} onPress={() => { setFilterName(null) }}>
              <IconMC name="close" size={16} color={theme['c-primary']} />
              <Text size={13} color={theme['c-primary']} numberOfLines={1} style={styles.filterText}>
                {t('category_filtering', { name: filterName, num: songs.length })}
              </Text>
            </TouchableOpacity>
          )
        : null}

      {loading
        ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme['c-primary-font']} />
            </View>
          )
        : isEmpty
          ? <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>
          : showAggregates
            ? (
                <FlatList
                  style={styles.list}
                  data={aggregates}
                  renderItem={renderAggregate}
                  keyExtractor={item => item.name}
                />
              )
            : (
                <FlatList
                  style={styles.list}
                  data={songs}
                  renderItem={renderSong}
                  keyExtractor={(item, index) => `${item.id}__${index}`}
                />
              )}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  filterText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 6,
  },
  aggregateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  aggregateName: {
    flexGrow: 1,
    flexShrink: 1,
  },
  aggregateArrow: {
    marginLeft: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
})
