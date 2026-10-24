import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import SubPageHeader from '@/screens/Home/Vertical/SubPageHeader'
import SongRow from '../../components/SongRow'
import ListMenu, { type ListMenuType, type Position } from '@/components/OnlineList/ListMenu'
import { clearMusicUrl, handleCollectMusic } from '@/components/OnlineList/listAction'
import DownloadModal, { type DownloadModalType } from '@/components/DownloadModal'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { REF_COLOR } from '@/config/uiPalette'
import { LIST_IDS, type NAV_ID_Type } from '@/config/constant'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { useIsTabletLayout } from '@/utils/hooks'
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
/**
 * 榜单歌曲页的容器（由 `Main.tsx` 使用）。
 *
 * 这个页面在 PagerView 里常驻，`FlatList` 背后的原生滚动偏移会一直沿用旧值
 * （实测直接进榜单一：第 1 首；再进第二个榜单：第 13/19 首，且落点随次数递增）。
 * `scrollToOffset(0)`、清空数据、换 `FlatList` 自身的 key 都压不住，
 * 只有**把整页卸载重建**才能让滚动偏移真正归零。
 * 这里在每次进入本页时把内部 `BoardSongs` 整棵子树换 key。
 */
export const BoardSongsPage = memo(() => {
  const activeId = useNavActiveId()
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (activeId != PAGE_ID) return
    // 每次进入都换一个实例
    setEpoch(prev => prev + 1)
  }, [activeId])
  return epoch ? <BoardSongs key={`board_${epoch}`} /> : null
})

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
const BoardSongs = memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const getQualityLabel = useQualityLabel()
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const listMenuRef = useRef<ListMenuType>(null)
  const downloadModalRef = useRef<DownloadModalType>(null)
  const musicAddModalRef = useRef<MusicAddModalType>(null)

  /** 最新列表的引用：让「⋯ 菜单」回调保持稳定，不必把 list 塞进 renderItem 依赖 */
  const listRef = useRef(list)
  useEffect(() => { listRef.current = list }, [list])

  const loadSeqRef = useRef(0)
  /** 已加载的榜单 id：相同则不重复拉取，避免每次进页面都把列表刷一遍（跳动） */
  const loadedBoardIdRef = useRef('')
  const scrollRef = useRef<ScrollView>(null)

  /**
   * 每次进入本页都由外层 `BoardSongsPage` 换 key 重建整个组件，
   * 所以这里不需要再自己维护 epoch；同一榜单直接复用已加载的数据。
   */
  const load = useCallback(async() => {
    const boardId = await getCurrentBoardId()
    if (boardId == loadedBoardIdRef.current && listRef.current.length) return
    const seq = ++loadSeqRef.current
    /**
     * 与交接包原版一致：加载期间整页切成转圈，等数据回来再一次性换成新列表。
     *
     * 之前为了「不闪」保留旧列表，实测会卡在半过渡的布局（行的 bounds 变成
     * 15px 高、bottom < top），肉眼就是列表在跳。转圈反而是收敛最快的状态。
     */
    setLoading(true)
    let result: LX.Music.MusicInfoOnline[] = []
    try {
      result = await getListDetailAll(boardId)
    } catch (err) {
      // 取不到时退回空态（错误日志交给 sdk 侧输出）
      console.log(err)
    }
    // 竞态保护：快速切榜单时只认最后一次的结果
    if (seq != loadSeqRef.current) return
    loadedBoardIdRef.current = boardId
    setLoading(false)
    requestAnimationFrame(() => { setList(result) })
  }, [])

  /**
   * 每次进入本页都先把列表**卸载**（`mounted=false` 渲染成转圈），再在下一帧挂载。
   */
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // 页面常驻不卸载：每次进入本页都重新取一次，避免榜单被改过后还显示旧数据
    if (activeId != PAGE_ID) {
      setMounted(false)
      return
    }
    setMounted(false)
    // 先卸掉旧列表，下一帧再挂载，保证新列表从第 1 行开始
    const timer = setTimeout(() => { setMounted(true) }, 0)
    void load()
    return () => { clearTimeout(timer) }
  }, [activeId, load])

  const handlePress = useCallback((index: number) => {
    const current = listRef.current
    if (!current.length) return
    // 先落临时列表再播，保证播放队列与页面看到的一致
    void setTempList(TEMP_LIST_ID, [...current]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [])

  const handleMore = useCallback((index: number, position: Position) => {
    const item = listRef.current[index]
    if (!item) return
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
      rowIndex={index}
      name={item.name}
      singer={item.singer}
      quality={getQualityLabel(item)}
      duration={item.interval ?? undefined}
      pic={item.meta.picUrl}
      musicInfo={item}
      musicId={item.id}
      onPressItem={handlePress}
      onMoreItem={handleMore}
    />
  ), [getQualityLabel, handleMore, handlePress])

  const empty = useMemo(() => (
    <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>
  ), [t])

  // 平板 / 横屏走双列，与歌单页（`OnlineList` 的 rowInfo.rowNum）保持一致
  const isTablet = useIsTabletLayout()
  const rowNum = isTablet ? 2 : 1

  if (loading || !mounted) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme['c-primary-font']} />
      </View>
    )
  }

  /**
   * 每次进入本页，外层 `BoardSongsPage` 都会换 key 重建整个组件。
   *
   * 这里不用 `FlatList` 而用 `ScrollView` + `map`：实测在这个常驻页面里，
   * `FlatList` 背后的原生/虚拟化滚动状态会跨榜单沿用，`scrollToOffset(0)`、
   * 清空数据、换 key、重挂载都压不住（落点 13 → 15 → 21 递增）。
   * 榜单歌曲是一次性全量展示（最多几百首），`ScrollView` 没有这层状态。
   */
  return (
    <View style={styles.root}>
      <ScrollView
        key={String(rowNum)}
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {list.length
          ? (
              <View style={rowNum > 1 ? styles.grid : undefined}>
                {list.map((item, index) => (
                  <View key={`${item.id}__${index}`} style={rowNum > 1 ? styles.cell : undefined}>
                    {renderItem({ item, index })}
                  </View>
                ))}
              </View>
            )
          : empty}
      </ScrollView>
      <ListMenu
        ref={listMenuRef}
        onPlay={(info) => { handlePress(info.index) }}
        onCollect={(info) => { void handleCollectMusic(info.musicInfo) }}
        onDownload={(info) => {
          downloadModalRef.current?.show({
            musicInfo: info.musicInfo,
            selectedList: [info.musicInfo],
          })
        }}
        onAdd={(info) => {
          musicAddModalRef.current?.show({ musicInfo: info.musicInfo, listId: '', isMove: false })
        }}
        onRemoveCache={(info) => { void clearMusicUrl(info.musicInfo) }}
      />
      <DownloadModal ref={downloadModalRef} />
      <MusicAddModal ref={musicAddModalRef} />
    </View>
  )
})

export default memo(BoardSongs)

const styles = createStyle({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
  },
  /** 平板双列：一行两首，列宽 50% */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
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
