import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import Input from '@/components/common/Input'
import SongThumb from '@/components/common/SongThumb'
import SectionHeader from '../../components/SectionHeader'
import { MINE_SECTIONS, type MineSectionId } from '@/config/homeTabs'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useI18n } from '@/lang'
import { navigateTo } from '@/core/common'
import { getListMusics, setActiveList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useMyList } from '@/store/list/hook'

/** 歌手名的分割符（与参考实现一致） */
const SINGER_SPLIT_RXP = /[、,;，；&/]/

interface AggregateItem {
  name: string
  count: number
}

/** 我的：搜索 + 四宫格（带计数）+ 结果列表 */
export default memo(() => {
  const t = useI18n()
  const [section, setSection] = useState<MineSectionId>('song')
  const [keyword, setKeyword] = useState('')
  const [musics, setMusics] = useState<LX.Music.MusicInfo[]>([])

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

  // 用 useMyList() 订阅：listState.allList 是可变 store，写死依赖的 useMemo
  // 会让新建 / 删除 / 重命名歌单后这里永不刷新（Home 页常驻，不会重挂载）
  const allList = useMyList()
  const userLists = useMemo(
    () => allList.filter(list => list.id != LIST_IDS.DEFAULT && list.id != LIST_IDS.LOVE),
    [allList],
  )

  const albums = useMemo<AggregateItem[]>(() => {
    const map = new Map<string, number>()
    for (const music of musics) {
      const album = music.meta.albumName
      if (!album) continue
      map.set(album, (map.get(album) ?? 0) + 1)
    }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [musics])

  const singers = useMemo<AggregateItem[]>(() => {
    const map = new Map<string, number>()
    for (const music of musics) {
      const names = (music.singer || '').split(SINGER_SPLIT_RXP).map(s => s.trim()).filter(Boolean)
      for (const name of names) map.set(name, (map.get(name) ?? 0) + 1)
    }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [musics])

  const counts = useMemo(() => ({
    song: musics.length,
    songlist: userLists.length,
    album: albums.length,
    singer: singers.length,
  }), [albums.length, musics.length, singers.length, userLists.length])

  const filteredMusics = useMemo(() => {
    if (!keyword) return musics
    const key = keyword.toLowerCase()
    return musics.filter(music =>
      music.name.toLowerCase().includes(key) ||
      (music.singer || '').toLowerCase().includes(key) ||
      (music.meta.albumName || '').toLowerCase().includes(key))
  }, [keyword, musics])

  const filteredAggregate = useCallback((list: AggregateItem[]) => {
    if (!keyword) return list
    const key = keyword.toLowerCase()
    return list.filter(item => item.name.toLowerCase().includes(key))
  }, [keyword])

  const handleAggregatePress = useCallback((name: string) => {
    setKeyword(name)
    setSection('song')
  }, [])

  const sectionMeta = MINE_SECTIONS.find(item => item.id == section)!

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* ② 搜索行 */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <IconMC name="magnify" size={18} color={REF_COLOR.textHint} />
          <Input
            style={styles.searchInput}
            value={keyword}
            placeholder={t('mine_search_placeholder')}
            placeholderTextColor={REF_COLOR.textHint}
            onChangeText={setKeyword}
            clearBtn={!!keyword}
            size={13}
          />
        </View>
        <TouchableOpacity style={styles.gear} activeOpacity={0.6} onPress={() => { navigateTo('nav_setting') }}>
          <IconMC name="cog-outline" size={24} color={REF_COLOR.text} />
        </TouchableOpacity>
      </View>

      {/* ③ 四宫格 */}
      <View style={styles.gridRow}>
        {MINE_SECTIONS.map(item => {
          const accent = REF_ACCENT[item.accent]
          const active = item.id == section
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.gridItem}
              activeOpacity={0.7}
              onPress={() => { setSection(item.id) }}
            >
              <View style={{
                ...styles.gridIcon,
                backgroundColor: accent.bg,
                borderWidth: 2,
                borderColor: active ? accent.color : 'transparent',
              }}>
                <IconMC name={item.icon} size={24} color={accent.color} />
              </View>
              <Text size={12} color={active ? accent.color : REF_COLOR.text} style={styles.gridLabel} numberOfLines={1}>
                {t(item.labelKey)}
              </Text>
              <Text size={11} color={REF_COLOR.textHint} style={styles.gridCount} numberOfLines={1}>
                {counts[item.id]} {t(item.unitKey)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ④ 计数标题行 */}
      <SectionHeader title={`${t(sectionMeta.labelKey)} · ${counts[section]}`} />

      {/* ⑤ 结果列表 */}
      {section == 'song'
        ? (filteredMusics.length
            ? filteredMusics.map((music, index) => (
                <View key={music.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    activeOpacity={0.7}
                    // 关键词筛选后 filteredMusics 的下标与收藏列表真实下标不一致，
                    // 直接传 index 会播错歌：按 id 找回真实位置
                    onPress={() => { void playList(LIST_IDS.LOVE, musics.findIndex(m => m.id == music.id)) }}
                  >
                    <SongThumb size={42} pic={music.meta.picUrl ?? null} musicInfo={music} />
                    <View style={styles.rowInfo}>
                      <Text size={14} numberOfLines={1} color={REF_COLOR.text}>{music.name}</Text>
                      <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.rowSub}>
                        {[music.singer, music.meta.albumName].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
            ))
            : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('mine_empty_song')}</Text>)
        : null}

      {section == 'songlist'
        ? (userLists.length
            ? userLists.map(list => (
                <TouchableOpacity
                  key={list.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    setActiveList(list.id)
                    navigateTo('nav_love')
                  }}
                >
                  <Text size={14} numberOfLines={1} color={REF_COLOR.text}>{list.name}</Text>
                </TouchableOpacity>
            ))
            : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('mine_empty_songlist')}</Text>)
        : null}

      {section == 'album' || section == 'singer'
        ? (() => {
            const list = filteredAggregate(section == 'album' ? albums : singers)
            const emptyKey = section == 'album' ? 'mine_empty_album' : 'mine_empty_singer'
            return list.length
              ? list.map(item => (
                  <TouchableOpacity
                    key={item.name}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => { handleAggregatePress(item.name) }}
                  >
                    <View style={styles.aggregateRow}>
                      <Text size={14} numberOfLines={1} color={REF_COLOR.text} style={styles.aggregateName}>{item.name}</Text>
                      <Text size={11} color={REF_COLOR.textHint}>{item.count} {t('mine_count_unit')}</Text>
                      <IconMC name="chevron-right" size={18} color={REF_COLOR.textHint} />
                    </View>
                  </TouchableOpacity>
              ))
              : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t(emptyKey)}</Text>
          })()
        : null}
    </ScrollView>
  )
})

const styles = createStyle({
  container: { flex: 1 },
  content: { paddingBottom: 20 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexGrow: 1,
    flexShrink: 1,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(49, 194, 124, 0.45)',
    backgroundColor: REF_ACCENT.green.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 6,
    paddingRight: 0,
    height: 34,
  },
  gear: {
    width: 38,
    height: 38,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 6,
  },
  gridItem: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
  },
  gridIcon: {
    width: 56,
    height: 56,
    borderRadius: scaleSizeW(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    marginTop: 6,
  },
  gridCount: {
    marginTop: 1,
  },
  row: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowInfo: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
  },
  rowSub: {
    marginTop: 2,
  },
  aggregateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aggregateName: {
    flexGrow: 1,
    flexShrink: 1,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
})
