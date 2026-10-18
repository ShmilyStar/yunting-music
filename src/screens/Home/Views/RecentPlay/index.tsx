import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import ModuleSearchBar from '../../components/ModuleSearchBar'
import SongRow from '../../components/SongRow'
import { REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS } from '@/config/constant'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useRecentPlay } from '@/store/recentPlay/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import { clearRecentPlay, initRecentPlay, searchRecentPlay } from '@/core/recentPlay'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'

/** 写进临时列表时用的列表标识（只作为 meta，实际数据落在 LIST_IDS.TEMP） */
const RECENT_TEMP_LIST_ID = 'recent__play'

/**
 * 最近播放（03 §8）。
 *
 * 数据源是独立的 `store/recentPlay`（持久化键 `@recent_play`，见 `core/recentPlay.ts`），
 * 不用播放器的临时/已播放列表——最近播放要跨会话保留。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const recentList = useRecentPlay()
  const playMusicInfo = usePlayMusicInfo()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void initRecentPlay().catch((err: unknown) => {
      console.log(err)
    }).then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  /** 搜索只过滤本模块：歌名 / 歌手 / 专辑名任意匹配 */
  const filteredList = useMemo(() => searchRecentPlay(keyword, recentList), [keyword, recentList])

  const currentId = playMusicInfo.musicInfo?.id

  const handlePress = useCallback((index: number) => {
    if (!filteredList.length) return
    // 先落临时列表，再按下标播放 —— 保证播放队列就是当前看到的这一份
    void setTempList(RECENT_TEMP_LIST_ID, [...filteredList]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [filteredList])

  const handleClear = useCallback(() => {
    void confirmDialog({ message: t('recent_clear_tip') }).then((confirm) => {
      if (confirm) void clearRecentPlay()
    })
  }, [t])

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfoOnline, index: number }) => (
    <SongRow
      index={index + 1}
      name={item.name}
      singer={item.singer}
      album={item.meta.albumName}
      pic={item.meta.picUrl}
      musicInfo={item}
      active={item.id == currentId}
      onPress={() => { handlePress(index) }}
    />
  ), [currentId, handlePress])

  return (
    <View style={styles.container}>
      <ModuleSearchBar
        placeholder={t('module_search_tip', { name: t('recent_play') })}
        value={keyword}
        onChangeText={setKeyword}
      />

      <View style={styles.listHeader}>
        <Text size={13} color={REF_COLOR.textSub} numberOfLines={1}>
          {t('recent_count_tip', { num: filteredList.length })}
        </Text>
        <TouchableOpacity style={styles.clearBtn} activeOpacity={0.6} onPress={handleClear}>
          <IconMC name="trash-can-outline" size={15} color={REF_COLOR.textHint} />
          <Text size={13} color={REF_COLOR.textHint} style={styles.clearText}>{t('recent_clear')}</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme['c-primary-font']} />
            </View>
          )
        : (
            <FlatList
              style={styles.list}
              data={filteredList}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.id}__${index}`}
              ListEmptyComponent={<Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('recent_empty')}</Text>}
            />
          )}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: 6,
  },
  clearText: {
    marginLeft: 4,
  },
  list: {
    flex: 1,
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
