import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongThumb from '@/components/common/SongThumb'
import { ActionIcon, type ActionIconName } from '@/components/player/ActionBtns'
import { REF_COLOR } from '@/config/uiPalette'
import {
  HEADER_HEIGHT,
  LIST_IDS,
  MUSIC_TOGGLE_MODE,
  MUSIC_TOGGLE_MODE_LIST,
} from '@/config/constant'
import { createStyle, toast } from '@/utils/tools'
import { isTabletLayout, scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useI18n, type Message } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useBackHandler, useIsTabletLayout, useWindowSize } from '@/utils/hooks'
import { useBottomBarHeight } from '@/screens/Home/Vertical/BottomTabBar'
import { useMiniPlayerSpace, useMiniPlayerVisible } from '@/screens/Home/Vertical/MiniPlayer'
import { registerPlayListPopup } from '@/core/playListPopup'
import { updateSetting } from '@/core/common'
import { getList } from '@/core/player/playInfo'
import { getListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { downloadMusic } from '@/core/music/downloadFile'

/** 展开 / 收起时长（05 §18） */
const OPEN_DURATION = 300
const CLOSE_DURATION = 240

/** 列表项尺寸（03 §13） */
const INDEX_WIDTH = 26
const THUMB_SIZE = 30

/** 多选模式的勾选框边长（03 §13） */
const CHECK_ICON_SIZE = 18

/**
 * 底部三键字号：**必须按字形分别给**（02 §5.4）。
 * MCI 的 `repeat` 可见占比约 0.83、`arrow-down` 约 0.75、`chevron-down` 仅约 0.5，
 * 给成同一个字号会明显大小不一。
 */
const FOOTER_MODE_SIZE = 20 // repeat
const FOOTER_ARROW_SIZE = 22 // arrow-down
const FOOTER_BACK_SIZE = 32 // chevron-down

/** 三键热区：上下 12 / 左右 22（03 §13） */
const FOOTER_HIT_SLOP = {
  top: scaleSizeH(12),
  bottom: scaleSizeH(12),
  left: scaleSizeW(22),
  right: scaleSizeW(22),
}

/** 播放模式 → 图标语义（与 `PlayModeBtn` 同一套字形） */
const MODE_ICON: Record<LX.AppSetting['player.togglePlayMethod'], ActionIconName> = {
  [MUSIC_TOGGLE_MODE.listLoop]: 'listLoop',
  [MUSIC_TOGGLE_MODE.random]: 'listRandom',
  [MUSIC_TOGGLE_MODE.list]: 'listOrder',
  [MUSIC_TOGGLE_MODE.singleLoop]: 'singleLoop',
  [MUSIC_TOGGLE_MODE.none]: 'single',
}

const MODE_TOAST: Record<LX.AppSetting['player.togglePlayMethod'], keyof Message> = {
  [MUSIC_TOGGLE_MODE.listLoop]: 'play_list_loop',
  [MUSIC_TOGGLE_MODE.random]: 'play_list_random',
  [MUSIC_TOGGLE_MODE.list]: 'play_list_order',
  [MUSIC_TOGGLE_MODE.singleLoop]: 'play_single_loop',
  [MUSIC_TOGGLE_MODE.none]: 'play_single',
}

/** 列表行的视图模型：把「本地列表歌曲」与「下载任务项」抹平成同一种形状 */
interface PlayListItem {
  id: string
  name: string
  singer: string
  pic: string | null
  musicInfo: LX.Music.MusicInfo
}

const toViewList = (items: Array<LX.Music.MusicInfo | LX.Download.ListItem>): PlayListItem[] => items.map(item => {
  const musicInfo: LX.Music.MusicInfo = 'progress' in item ? item.metadata.musicInfo : item
  return {
    id: musicInfo.id,
    name: musicInfo.name,
    singer: musicInfo.singer,
    pic: musicInfo.meta.picUrl ?? null,
    musicInfo,
  }
})

interface BatchResult {
  failed: number
  lastPath: string | null
}

/**
 * 逐首直下。用 `core/music/downloadFile` 的 `downloadMusic` 而不是下载引擎
 * `core/download`：弹层需要在原地显示 `done/total`，前者按首 await 落地、
 * 天然能算出完成数；后者只是把任务丢进下载管理队列（还受「下载功能」开关
 * 与任务去重影响），进度只在下载页可见。
 */
const runBatchDownload = async(
  targets: PlayListItem[],
  onProgress: (done: number, total: number) => void,
): Promise<BatchResult> => {
  let done = 0
  let failed = 0
  let lastPath: string | null = null
  for (const item of targets) {
    try {
      lastPath = await downloadMusic({ musicInfo: item.musicInfo })
    } catch (err) {
      failed++
      // 本地歌曲不支持下载是预期内的失败，不当异常打日志
      if ((err as Error | undefined)?.message !== 'DOWNLOAD_UNSUPPORTED_SOURCE') console.log(err)
    }
    onProgress(++done, targets.length)
  }
  return { failed, lastPath }
}

const FooterBtn = ({ onPress, children }: { onPress: () => void, children: ReactNode }) => (
  <TouchableOpacity style={styles.footerBtn} activeOpacity={0.5} hitSlop={FOOTER_HIT_SLOP} onPress={onPress}>
    {children}
  </TouchableOpacity>
)

/**
 * 播放列表弹层（03 §13、05 §10）。
 *
 * - **不是页面**：绝对定位的全屏弹出层，高度 = 窗口高 − 底部 Tab 总高，
 *   收起时整体下移自身高度，上边缘正好落在底部栏上框线处（视觉上是
 *   「从底栏上框线后面钻出来」）。`elevation: 10`：> mini 条 6、< 底栏 12。
 * - 挂载顺序由使用方保证：`... <MiniPlayer/> <PlayListPopup/> <BottomTabBar/>`。
 * - 通过 `core/playListPopup` 的注册表接收 `showPlayListPopup()`，自己控制显隐。
 */
export default memo(({ variant = 'page', topInset = 0 }: { variant?: 'page' | 'home', topInset?: number }) => {
  const t = useI18n()
  const theme = useTheme()
  const { height: windowHeight } = useWindowSize()
  const bottomBarHeight = useBottomBarHeight()
  const miniSpace = useMiniPlayerSpace()
  const statusBarHeight = useStatusbarHeight()
  const playInfo = usePlayInfo()
  const playMusicInfo = usePlayMusicInfo()
  // 与 mini 条同一判据：只有它真的显示时才把下沿抬到它上框线
  const miniVisible = useMiniPlayerVisible()
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  /**
   * 两套挂载上下文，几何与内容都不一样：
   * - `page`（播放页）：铺满底部三 Tab 以上的全部区域，自己带标题与底部三键
   * - `home`（主页外壳 / 歌单详情）：上沿贴顶栏下框线、下沿落在 mini 条上框线，
   *   不画标题（顶栏已有）、不画底部三键
   */
  const isHome = variant == 'home'
  const isTablet = useIsTabletLayout()

  const [rendered, setRendered] = useState(false)
  const [list, setList] = useState<PlayListItem[]>([])
  const [listVersion, setListVersion] = useState(0)
  /** 多选下载模式 */
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** 批量下载进度（null = 不在下载中） */
  const [batchProgress, setBatchProgress] = useState<{ done: number, total: number } | null>(null)

  const enterAnim = useRef(new Animated.Value(1)).current
  const closeAnimRef = useRef<Animated.CompositeAnimation | null>(null)
  const mountedRef = useRef(true)

  /**
   * 面板几何：
   * - `home`：上沿 = 顶栏下框线（状态栏 + 标题栏高），下沿 = mini 控制器栏上框线
   *   （没歌时退到底部三 Tab 上框线）；收起态下移自身高度 → 从 mini 条后面钻出来
   * - `page`：上沿 = `topInset`（默认 0，铺满三 Tab 以上全部区域）；手机播放页会
   *   传入标题栏高度，保证弹层也不盖住「发现 / 音乐馆 / 我的」标题栏
   */
  const panelTop = isHome ? scaleSizeH(HEADER_HEIGHT) + statusBarHeight : topInset
  const panelHeight = Math.max(windowHeight - panelTop - bottomBarHeight - (isHome && miniVisible ? miniSpace : 0), 0)
  const queueListId = playInfo.playerListId ?? playMusicInfo.listId ?? null
  const currentId = playMusicInfo.musicInfo?.id

  const refresh = useCallback(() => { setListVersion(v => v + 1) }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  /** 播放队列：优先用播放器自己的列表 id，退回当前歌曲所属列表 */
  useEffect(() => {
    if (!rendered) return undefined
    let cancelled = false
    const run = async() => {
      if (!queueListId) {
        setList([])
        return
      }
      try {
        // 下载列表只存在于内存（不在 allMusicList 的持久化列表里），单独取
        const items = queueListId == LIST_IDS.DOWNLOAD
          ? getList(queueListId)
          : await getListMusics(queueListId)
        if (!cancelled) setList(toViewList(items))
      } catch (err) {
        console.log(err)
        if (!cancelled) setList([])
      }
    }
    void run()
    return () => { cancelled = true }
  }, [rendered, queueListId, listVersion])

  /** 队列内容被别处改写（榜单 / 最近播放覆盖临时列表）时跟着刷新 */
  useEffect(() => {
    global.app_event.on('myListMusicUpdate', refresh)
    global.state_event.on('mylistUpdated', refresh)
    return () => {
      global.app_event.off('myListMusicUpdate', refresh)
      global.state_event.off('mylistUpdated', refresh)
    }
  }, [refresh])

  const open = useCallback(() => {
    closeAnimRef.current?.stop()
    closeAnimRef.current = null
    setRendered(true)
    setSelectMode(false)
    setSelectedIds(new Set())
    refresh()
    // 首帧先以静态位移落位（落在底栏上框线处），下一帧再向上划出
    enterAnim.setValue(1)
    requestAnimationFrame(() => {
      Animated.timing(enterAnim, {
        toValue: 0,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    })
  }, [enterAnim, refresh])

  const close = useCallback(() => {
    if (!rendered) return
    setSelectMode(false)
    closeAnimRef.current?.stop()
    const animation = Animated.timing(enterAnim, {
      toValue: 1,
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    })
    closeAnimRef.current = animation
    animation.start(({ finished }) => {
      closeAnimRef.current = null
      if (finished) setRendered(false)
    })
  }, [enterAnim, rendered])

  // 注册到全局注册表：唤起时只会通知最后注册的实例（最上层的那个）
  useEffect(() => registerPlayListPopup({
    show: open,
    toggle: () => { if (rendered) close(); else open() },
  }), [open, close, rendered])

  // 弹层打开时，返回键先关弹层（02 §9.2）
  useBackHandler(useCallback(() => {
    if (!rendered) return false
    close()
    return true
  }, [rendered, close]))

  const handleToggleMode = useCallback(() => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    toast(t(MODE_TOAST[mode]))
  }, [togglePlayMethod, t])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleRowPress = useCallback((index: number) => {
    const item = list[index]
    if (!item) return
    if (selectMode) {
      handleToggleSelect(item.id)
      return
    }
    if (!queueListId) return
    // 播完即收起（与上游播放列表面板的交互一致）
    void playList(queueListId, index).catch((err: unknown) => {
      console.log(err)
    }).then(() => { close() })
  }, [list, selectMode, handleToggleSelect, queueListId, close])

  const handleDownloadPress = useCallback(() => {
    if (batchProgress) return
    if (!selectMode) {
      setSelectMode(true)
      setSelectedIds(new Set())
      return
    }
    const targets = list.filter(item => selectedIds.has(item.id))
    if (!targets.length) {
      setSelectMode(false)
      return
    }
    setBatchProgress({ done: 0, total: targets.length })
    void runBatchDownload(targets, (done, total) => {
      if (mountedRef.current) setBatchProgress({ done, total })
    }).then(({ failed, lastPath }) => {
      if (!mountedRef.current) return
      setBatchProgress(null)
      setSelectMode(false)
      setSelectedIds(new Set())
      if (failed) toast(t('play_download_failed'))
      else toast(t('play_download_success', { path: lastPath ?? '' }), 'long')
    }).catch((err: unknown) => {
      // 批量流程本身出问题也要把进度复位，否则下载键会被永久挡住
      console.log(err)
      if (mountedRef.current) setBatchProgress(null)
    })
  }, [batchProgress, list, selectMode, selectedIds, t])

  const renderItem = useCallback(({ item, index }: { item: PlayListItem, index: number }) => {
    const active = item.id == currentId
    const checked = selectedIds.has(item.id)
    return (
      <TouchableOpacity
        style={{
          ...styles.row,
          ...(isTabletLayout ? styles.rowTablet : null),
          borderBottomColor: REF_COLOR.divider,
        }}
        activeOpacity={0.7}
        onPress={() => { handleRowPress(index) }}
      >
        {selectMode
          ? (
              <IconMC
                name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={CHECK_ICON_SIZE}
                color={checked ? theme['c-primary'] : REF_COLOR.textHint}
                style={styles.checkbox}
              />
            )
          : null}
        <Text
          style={styles.index}
          size={12}
          color={active ? theme['c-primary'] : REF_COLOR.textHint}
        >
          {index + 1}
        </Text>
        <SongThumb size={THUMB_SIZE} pic={item.pic} musicInfo={item.musicInfo} rounded={4} />
        <View style={styles.info}>
          <Text size={14} numberOfLines={1} color={active ? theme['c-primary'] : REF_COLOR.text}>{item.name}</Text>
          <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.singer}>{item.singer}</Text>
        </View>
      </TouchableOpacity>
    )
  }, [currentId, handleRowPress, selectedIds, selectMode, theme])

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, panelHeight],
  })

  if (!rendered) return null

  return (
    <Animated.View
      style={{
        ...styles.panel,
        top: panelTop,
        height: panelHeight,
        transform: [{ translateY }],
      }}
    >
      {/* 背景画在内容容器上，面板本身透明 */}
      <View style={{ ...styles.content, backgroundColor: theme['c-content-background'] }}>
        {/* 播放列表不再画自己的标题栏：上方的「发现 / 音乐馆 / 我的」标题栏已经说明位置；
            只有多选下载时留一条细行显示已选数量 */}
        {selectMode
          ? (
              <View style={{
                ...styles.header,
                height: scaleSizeH(HEADER_HEIGHT) * 0.7,
                borderBottomColor: theme['c-list-header-border-bottom'],
              }}>
                <View style={styles.headerRight}>
                  <Text size={12} color={theme['c-primary']} numberOfLines={1}>
                    {t('download__multiple_tip', { len: selectedIds.size })}
                  </Text>
                </View>
              </View>
            )
          : null}

        {list.length
          ? (
              <FlatList
                // 列数变化必须重建列表，否则 FlatList 会沿用旧的 measure
                key={isTabletLayout ? 'tablet' : 'phone'}
                style={styles.list}
                data={list}
                numColumns={isTablet ? 2 : 1}
                columnWrapperStyle={isTablet ? styles.column : undefined}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.id}__${index}`}
                extraData={selectedIds}
              />
            )
          : <Text size={12} color={REF_COLOR.textHint} style={styles.empty}>{t('no_item')}</Text>}

        {/* 底部三键（播放模式 / 下载 / 收起）只在播放页那份弹层里出现；
            外壳那份不带（用户要求），关闭靠 mini 条上的按钮再点一次或返回键 */}
        {isHome
          ? null
          : (
              <View style={{ ...styles.footer, borderTopColor: theme['c-border-background'] }}>
                <FooterBtn onPress={handleToggleMode}>
                  <ActionIcon name={MODE_ICON[togglePlayMethod]} iconType="mc" size={FOOTER_MODE_SIZE} color={theme['c-primary']} />
                </FooterBtn>
                <FooterBtn onPress={handleDownloadPress}>
                  {batchProgress
                    ? (
                        <Text size={11} color={theme['c-primary']}>{`${batchProgress.done}/${batchProgress.total}`}</Text>
                      )
                    : <IconMC name="arrow-down" size={FOOTER_ARROW_SIZE} color={theme['c-primary']} />}
                </FooterBtn>
                <FooterBtn onPress={close}>
                  <IconMC name="chevron-down" size={FOOTER_BACK_SIZE} color={theme['c-primary']} />
                </FooterBtn>
              </View>
            )}
      </View>
    </Animated.View>
  )
})

const styles = createStyle({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // > mini 播放条 6、< 底部三 Tab 12（02 §8.1）
    elevation: 10,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerRight: {
    position: 'absolute',
    right: 14,
    bottom: 0,
    // 与标题同一高度带，保证计数仍是垂直居中的观感
    height: HEADER_HEIGHT,
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  column: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  rowTablet: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  checkbox: {
    marginRight: 6,
  },
  index: {
    width: INDEX_WIDTH,
    textAlign: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 10,
  },
  singer: {
    marginTop: 2,
  },
  footer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    // 与控制行的两端内边距一致（PlayBar 是 12+2），三键才能和播放页的
    // 播放模式 / 播放暂停 / 播放列表横向对齐
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
  },
  footerBtn: {
    // 固定与控制行 ActionBtn 同宽，配合 space-between 落位
    width: 36,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  empty: {
    flexGrow: 1,
    textAlign: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
})
