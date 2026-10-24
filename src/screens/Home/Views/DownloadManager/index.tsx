import { memo, useCallback, useMemo, useState, useEffect } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongThumb from '@/components/common/SongThumb'
import ModuleSearchBar from '../../components/ModuleSearchBar'
import { REF_COLOR } from '@/config/uiPalette'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useDownloadList } from '@/store/download/hook'
import { removeTasks } from '@/core/download'
import { LIST_IDS } from '@/config/constant'
import { playList } from '@/core/player/player'

/** 字节 → MB（保留 1 位） */
const toMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
/** 搜索输入防抖时长 */
const SEARCH_DEBOUNCE = 200

/**
 * 已下载歌曲管理（音乐馆入口）。
 *
 * 管的是**已经落到本地文件**的那些歌：只列 `status === 'completed'` 的下载，
 * 点行直接播放本地文件（播放器按 `LIST_IDS.DOWNLOAD` 取队列，走本地路径），
 * 单条可删除（连文件），也可一键全部删除。
 * 下载中的任务不在这里管，仍走播放页 / 弹层的下载入口。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const tasks = useDownloadList()
  const [keyword, setKeyword] = useState('')
  /** 防抖后的查询词：列表只跟着它过滤，输入本身不触发重算 */
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(keyword) }, SEARCH_DEBOUNCE)
    return () => { clearTimeout(timer) }
  }, [keyword])

  // 保留它在完整下载队列里的下标：播放器按 LIST_IDS.DOWNLOAD 的整表下标定位
  const items = useMemo(
    () => tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.status === 'completed'),
    [tasks],
  )

  const queryLower = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!queryLower) return items
    return items.filter(({ task }) => {
      const info = task.metadata.musicInfo
      return info.name.toLowerCase().includes(queryLower) ||
        (info.singer || '').toLowerCase().includes(queryLower) ||
        (info.meta.albumName || '').toLowerCase().includes(queryLower)
    })
  }, [items, queryLower])

  const handlePlay = useCallback((index: number) => {
    void playList(LIST_IDS.DOWNLOAD, index)
  }, [])

  const handleRemove = useCallback((task: LX.Download.ListItem) => {
    void confirmDialog({ message: t('download__remove_file_tip') }).then((confirm) => {
      if (confirm) void removeTasks([task], true)
    })
  }, [t])

  const handleRemoveAll = useCallback(() => {
    if (!items.length) return
    void confirmDialog({ message: t('download__remove_file_tip') }).then((confirm) => {
      if (confirm) void removeTasks(items.map(({ task }) => task), true)
    })
  }, [items, t])

  const renderItem = useCallback(({ item }: { item: { task: LX.Download.ListItem, index: number } }) => {
    const musicInfo = item.task.metadata.musicInfo
    const quality = item.task.metadata.quality
    const ext = item.task.metadata.ext
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={() => { handlePlay(item.index) }}>
          <SongThumb size={42} pic={musicInfo.meta.picUrl ?? null} musicInfo={musicInfo} />
          <View style={styles.info}>
            <Text size={14} numberOfLines={1} color={REF_COLOR.text}>{musicInfo.name}</Text>
            <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.sub}>
              {[musicInfo.singer, quality, ext ? ext.toUpperCase() : null, item.task.total ? toMB(item.task.total) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={() => { handleRemove(item.task) }}>
          <IconMC name="delete-outline" size={20} color={REF_COLOR.textHint} />
        </TouchableOpacity>
      </View>
    )
  }, [handlePlay, handleRemove])

  return (
    <View style={styles.container}>
      <ModuleSearchBar
        placeholder={t('downloaded_search_placeholder')}
        value={keyword}
        onChangeText={setKeyword}
      />
      <View style={styles.actionRow}>
        <Text size={13} color={REF_COLOR.textSub} numberOfLines={1} style={styles.count}>
          {t('recent_count_tip', { num: items.length })}
        </Text>
        {items.length
          ? (
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={handleRemoveAll}>
                <Text size={13} color={theme['c-primary']}>{t('download_clear_all')}</Text>
              </TouchableOpacity>
            )
          : null}
      </View>
      <FlatList
        style={styles.list}
        data={filtered}
        renderItem={renderItem}
        keyExtractor={({ task }) => task.id}
        ListEmptyComponent={<Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('downloaded_empty')}</Text>}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  count: {
    flexGrow: 1,
    flexShrink: 1,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  rowMain: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  sub: {
    marginTop: 3,
  },
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
})
