import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import ModuleSearchBar from '../../components/ModuleSearchBar'
import SourceSwitch from '../../components/SourceSwitch'
import { getBoardAccent, getBoardIcon } from '../../components/boardIcon'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { navigateTo } from '@/core/common'
import { getBoardsList, setActiveBoardName } from '@/core/leaderboard'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import boardState, { type BoardItem } from '@/store/leaderboard/state'

const PAGE_ID = 'nav_top'

type Status = 'loading' | 'idle' | 'error'

/** 榜单行：左侧图标底 + 榜单名 + 来源 + chevron-right */
const BoardRow = memo(({
  item, source, listSize, onPress,
}: {
  item: BoardItem
  source: LX.OnlineSource
  /** 榜单总数（`getBoardAccent` 的取色入参，与发现页卡片保持一致） */
  listSize: number
  onPress: (item: BoardItem) => void
}) => {
  const t = useI18n()
  const sourceNameType = useSettingValue('common.sourceNameType')
  const accent = REF_ACCENT[getBoardAccent(item.name, listSize)]

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => { onPress(item) }}>
      <View style={{ ...styles.iconPlate, backgroundColor: accent.bg }}>
        <IconMC name={getBoardIcon(item.name)} size={22} color={accent.color} />
      </View>
      <View style={styles.info}>
        <Text size={14} numberOfLines={1} color={REF_COLOR.text}>{item.name}</Text>
        <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.sub}>
          {t(`source_${sourceNameType}_${source}` as Parameters<typeof t>[0])}
        </Text>
      </View>
      <IconMC name="chevron-right" size={20} color={REF_COLOR.textHint} />
    </TouchableOpacity>
  )
})

/**
 * 排行榜页（03 §6）：搜索行 + 源胶囊行 + 榜单列表。
 * 标题栏由主页外壳的 `SubPageHeader` 提供，本页不自带。
 */
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const [source, setSource] = useState<LX.OnlineSource>(boardState.sources[0] ?? 'kw')
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [keyword, setKeyword] = useState('')

  const loadBoards = useCallback(async(source: LX.OnlineSource) => {
    setStatus('loading')
    try {
      const list = await getBoardsList(source)
      setBoards(list)
      setStatus('idle')
      return list
    } catch (err) {
      // 错误日志由 sdk 侧输出，这里只落错误态（可点击重试）
      console.log(err)
      setBoards([])
      setStatus('error')
      return []
    }
  }, [])

  // 页面常驻不卸载：每次进入本页都重新读一次持久化的源，保证与发现页「更多」进来时一致
  useEffect(() => {
    if (activeId != PAGE_ID) return
    let cancelled = false
    void getLeaderboardSetting().then(({ source }) => {
      if (cancelled) return
      setSource(source)
      void loadBoards(source)
    })
    return () => { cancelled = true }
  }, [activeId, loadBoards])

  const handleChangeSource = useCallback((source: LX.OnlineSource) => {
    setSource(source)
    setKeyword('')
    void loadBoards(source).then((list) => {
      // 切源后原来的 boardId 可能不属于该源，改存该源首个榜单，保证跳转后看到的是同一份数据
      void saveLeaderboardSetting(list.length ? { source, boardId: list[0].id } : { source })
    })
  }, [loadBoards])

  const handlePressBoard = useCallback((item: BoardItem) => {
    // 榜单歌曲页的标题直接读这个普通字段（无事件通知）
    setActiveBoardName(item.name)
    void saveLeaderboardSetting({ source, boardId: item.id })
    navigateTo('nav_board_songs')
  }, [source])

  const handleRetry = useCallback(() => {
    void loadBoards(source)
  }, [loadBoards, source])

  const list = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return boards
    return boards.filter(item => item.name.toLowerCase().includes(kw))
  }, [boards, keyword])

  const renderItem = useCallback(({ item }: { item: BoardItem }) => (
    <BoardRow item={item} source={source} listSize={boards.length} onPress={handlePressBoard} />
  ), [boards.length, source, handlePressBoard])

  const sources = boardState.sources
  const empty = useMemo(() => (
    status == 'error'
      ? <Text size={12} color={REF_COLOR.textHint} style={styles.empty} onPress={handleRetry}>{t('list_error')}</Text>
      : status == 'loading'
        ? <View style={styles.center}><ActivityIndicator color={theme['c-primary-font']} /></View>
        : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>
  ), [handleRetry, status, t, theme])

  return (
    <View style={styles.container}>
      <ModuleSearchBar
        placeholder={t('module_search_tip', { name: t('hall_leaderboard') })}
        value={keyword}
        onChangeText={setKeyword}
      />
      <View style={styles.sourceRow}>
        {/* 独占一行：两端留白对称，胶囊拉伸铺满整行 */}
        <SourceSwitch sources={sources} active={source} onSelect={handleChangeSource} variant="block" />
      </View>
      <FlatList
        style={styles.list}
        data={list}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={empty}
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
    paddingTop: 10,
  },
  sourceRow: {
    // 两端对称：胶囊铺满整行时看起来是居中的
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  iconPlate: {
    width: 42,
    height: 42,
    borderRadius: scaleSizeW(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
    paddingRight: 8,
  },
  sub: {
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
  center: {
    paddingTop: 30,
    paddingBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
