import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, View } from 'react-native'
import Text from '@/components/common/Text'
import SubPageHeader from '@/screens/Home/Vertical/SubPageHeader'
import SongRow from '../../components/SongRow'
import ListMenu, { type ListMenuType, type Position } from '@/components/OnlineList/ListMenu'
import { clearMusicUrl, handleDislikeMusic, handlePlayLater, handleShare, handleShowMusicSourceDetail } from '@/components/OnlineList/listAction'
import DownloadModal, { type DownloadModalType } from '@/components/DownloadModal'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS, type NAV_ID_Type } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import boardState from '@/store/leaderboard/state'
import { getCurrentBoardId, getListDetailAll } from '@/core/leaderboard'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'

const PAGE_ID: NAV_ID_Type = 'nav_board_songs'
/** 写进临时列表时用的列表标识（只作为 meta，实际数据落在 LIST_IDS.TEMP） */
const TEMP_LIST_ID = 'board__play'

/**
 * 榜单歌曲页的标题栏（03 §7）。
 *
 * `boardState.activeBoardName` 是个**没有事件通知的普通字段**（排行榜页在跳转前
 * 直接赋值），而页面内容被 `Main` 的两层 memo 隔离、不会随父级重渲染，
 * 所以标题必须**主动订阅导航变化**：切到本页时重渲染一次，正好读到跳转前
 * 写入的榜单名；读不到就回退「排行榜」。
 */
export const BoardSongsHeader = memo(() => {
  const t = useI18n()
  const activeId = useNavActiveId()
  const title = activeId == PAGE_ID ? boardState.activeBoardName : ''
  return <SubPageHeader title={title || t('hall_leaderboard')} />
})

/** 音质标签（与 `components/OnlineList/ListItem` 的取法一致） */
const useQualityLabel = () => {
  const t = useI18n()
  return useCallback((item: LX.Music.MusicInfoOnline): string => {
    if (item.meta._qualitys?.flac24bit) return t('quality_lossless_24bit')
    if (item.meta._qualitys?.flac ?? item.meta._qualitys?.ape) return t('quality_lossless')
    if (item.meta._qualitys?.['320k']) return t('quality_high_quality')
    return ''
  }, [t])
}

/**
 * 榜单歌曲列表本体（03 §7）。
 *
 * 数据取当前榜单的全量歌曲：`getLeaderboardSetting()` → `getListDetailAll(boardId)`，
 * 不分页（榜单歌曲页是「一次看全」的形态）。行右侧带 ⋯ 菜单，复用在线列表那套。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const playMusicInfo = usePlayMusicInfo()
  const getQualityLabel = useQualityLabel()
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const listMenuRef = useRef<ListMenuType>(null)
  const downloadModalRef = useRef<DownloadModalType>(null)
  const musicAddModalRef = useRef<MusicAddModalType>(null)

  const load = useCallback(async() => {
    setLoading(true)
    let result: LX.Music.MusicInfoOnline[] = []
    try {
      result = await getListDetailAll(await getCurrentBoardId())
    } catch (err) {
      // 取不到时退回空态（错误日志交给 sdk 侧输出）
      console.log(err)
    }
    setList(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    // 页面常驻不卸载：每次进入本页都重新取一次，避免榜单被改过后还显示旧数据
    if (activeId != PAGE_ID) return
    void load()
  }, [activeId, load])

  const currentId = playMusicInfo.musicInfo?.id

  const handlePress = useCallback((index: number) => {
    if (!list.length) return
    // 先落临时列表再播，保证播放队列与页面看到的一致
    void setTempList(TEMP_LIST_ID, [...list]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [list])

  const handleMore = useCallback((item: LX.Music.MusicInfoOnline, index: number, position: Position) => {
    listMenuRef.current?.show({
      musicInfo: item,
      index,
      single: true,
      selectedList: [item],
    }, position)
  }, [])

  const renderItem = useCallback(({ item, index }: { item: LX.Music.MusicInfoOnline, index: number }) => (
    <SongRow
      index={index + 1}
      name={item.name}
      singer={item.singer}
      quality={getQualityLabel(item)}
      duration={item.interval ?? undefined}
      pic={item.meta.picUrl}
      musicInfo={item}
      active={item.id == currentId}
      onPress={() => { handlePress(index) }}
      onMore={(position) => { handleMore(item, index, position) }}
    />
  ), [currentId, getQualityLabel, handleMore, handlePress])

  const empty = useMemo(() => (
    <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>
  ), [t])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme['c-primary-font']} />
      </View>
    )
  }

  return (
    <>
      <FlatList
        style={styles.list}
        data={list}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}__${index}`}
        ListEmptyComponent={empty}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />
      <ListMenu
        ref={listMenuRef}
        onPlay={(info) => { handlePress(info.index) }}
        onPlayLater={(info) => { handlePlayLater(info.musicInfo, info.selectedList, () => {}) }}
        onDownload={(info) => {
          downloadModalRef.current?.show({
            musicInfo: info.musicInfo,
            selectedList: [info.musicInfo],
          })
        }}
        onCopyName={(info) => { handleShare(info.musicInfo) }}
        onAdd={(info) => {
          musicAddModalRef.current?.show({ musicInfo: info.musicInfo, listId: '', isMove: false })
        }}
        onMusicSourceDetail={(info) => { void handleShowMusicSourceDetail(info.musicInfo) }}
        onRemoveCache={(info) => { void clearMusicUrl(info.musicInfo) }}
        onDislikeMusic={(info) => { void handleDislikeMusic(info.musicInfo) }}
      />
      <DownloadModal ref={downloadModalRef} />
      <MusicAddModal ref={musicAddModalRef} />
    </>
  )
})

const styles = createStyle({
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
