import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useIsTabletLayout } from '@/utils/hooks'
import { navigateTo } from '@/core/common'
import { getBoardsList, setActiveBoardName } from '@/core/leaderboard'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import boardState, { type BoardItem } from '@/store/leaderboard/state'

const PAGE_ID = 'nav_top'

type Status = 'loading' | 'idle' | 'error'

/** 榜单行：左侧图标底 + 榜单名 + 来源 + chevron-right */
const BoardRow = memo(({
  item, source, listSize, isTablet, onPress,
}: {
  item: BoardItem
  source: LX.OnlineSource
  /** 榜单总数（`getBoardAccent` 的取色入参，与发现页卡片保持一致） */
  listSize: number
  /**
   * 平板双列布局。
   *
   * **只有这种情况才能用 `flexBasis: 0`**：双列时行内要按「等分宽度」分摊，
   * 需要 flex 主轴（横向）basis 归零；而手机单列时 `flexBasis: 0` 落在**纵向**主轴上，
   * 会把每一行的高度压成 0——行与行重叠、图标溢出、列表总高度塌陷，
   * 用户看到的就是「排行榜点更多进来后显示错误」（实测 Android 1206×2622 必现）。
   */
  isTablet: boolean
  onPress: (item: BoardItem) => void
}) => {
  const t = useI18n()
  const sourceNameType = useSettingValue('common.sourceNameType')
  const accent = REF_ACCENT[getBoardAccent(item.name, listSize)]

  return (
    <TouchableOpacity
      style={isTablet ? styles.rowTablet : styles.row}
      activeOpacity={0.7}
      onPress={() => { onPress(item) }}
    >
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
  const [source, setSource] = useState<LX.OnlineSource>(boardState.sources[0] ?? 'kg')
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [keyword, setKeyword] = useState('')
  const isTablet = useIsTabletLayout()

  /** 请求序号：快速切源时只认最后一次的结果 */
  const loadSeqRef = useRef(0)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    isUnmountedRef.current = false
    return () => { isUnmountedRef.current = true }
  }, [])

  const loadBoards = useCallback(async(source: LX.OnlineSource) => {
    const seq = ++loadSeqRef.current
    setStatus('loading')
    try {
      const list = await getBoardsList(source)
      if (isUnmountedRef.current || seq != loadSeqRef.current) return list
      setBoards(list)
      setStatus('idle')
      return list
    } catch (err) {
      // 错误日志由 sdk 侧输出，这里只落错误态（可点击重试）
      console.log(err)
      if (isUnmountedRef.current || seq != loadSeqRef.current) return []
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

  /**
   * 「源已确定」标记：为 true 之前不渲染列表。
   *
   * `source` 的初值是 `boardState.sources[0]`（源的注册顺序，通常是 kw），
   * 与用户持久化的源无关。若直接渲染，会先按错误的源请求一轮，
   * 用户看到「空列表 / 报错 → 才变成对的」——从发现页「更多」进来时尤其明显。
   */
  const [ready, setReady] = useState(false)

  // 设置读回来（首次加载结束）之后才允许渲染列表
  useEffect(() => {
    if (activeId != PAGE_ID) return
    if (status != 'loading') setReady(true)
  }, [activeId, status])

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
    <BoardRow
      item={item}
      source={source}
      listSize={boards.length}
      isTablet={isTablet}
      onPress={handlePressBoard}
    />
  ), [boards.length, source, isTablet, handlePressBoard])

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
        // numColumns 运行中不可变，旋转 / 分屏时用 key 重建
        key={isTablet ? 'tablet' : 'phone'}
        style={styles.list}
        // 未 ready 时不渲染任何行：避免先按「错误的源」渲染一轮再被修正
        data={ready ? list : []}
        numColumns={isTablet ? 2 : 1}
        columnWrapperStyle={isTablet ? styles.column : undefined}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={ready ? empty : <View style={styles.center}><ActivityIndicator color={theme['c-primary-font']} /></View>}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={7}
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
  column: {
    gap: 8,
    paddingHorizontal: 6,
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
  /** 平板双列：等分宽度（`flexBasis: 0` 只在横向主轴上成立，见 `BoardRow`） */
  rowTablet: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
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
