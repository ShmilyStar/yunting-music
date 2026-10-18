import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongThumb from '@/components/common/SongThumb'
import { LoveBtn, PlayListBtn, PlayModeBtn } from '@/components/player/ActionBtns'
import { REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW, scaleSizeH } from '@/utils/pixelRatio'
import { useIsTabletLayout, useWindowSize } from '@/utils/hooks'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import playerState from '@/store/player/state'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { useBottomBarHeight } from './BottomTabBar'

const PHONE_HEIGHT = 58
const TABLET_HEIGHT = 66
const TABLET_COMPACT_HEIGHT = 52
/** 条上下外边距合计（设计值） */
const MINI_MARGIN_Y = 8
/** 平板分档阈值：条宽 < 940dp 走紧凑档（竖屏平板） */
const TABLET_COMPACT_WIDTH = 940
/**
 * 平板三键的槽宽（设计值）。
 *
 * 右侧「播放模式 / 收藏 / 播放列表」用的是 ActionBtn 的 36，中心距 36；
 * 左侧三键也用 36 的槽，左右两组节奏才一致（用户反馈要求对齐）。
 * 播放键圆底 42（紧凑 32）画在槽里、居中溢出即可，不参与槽宽计算。
 */
const TABLET_SLOT = 36

/**
 * mini 条是否真的显示。
 *
 * 弹层要按它算「下沿落在 mini 条上框线」——必须和 mini 条自身用**同一个判据**
 * （`playerState.musicInfo`），否则播放队列元数据缺失时弹层会算成没有 mini 条、
 * 下沿落到 Tab 栏上框线，看起来就像「从 Tab 栏弹出来」。
 */
export const useMiniPlayerVisible = () => !!usePlayerMusicInfo().id

/**
 * mini 条占用的竖向空间（条高 + 上下外边距，px）。
 *
 * 页面列表要按这个值留底部内边距，否则最后一行会被 mini 条压住。
 */
export const useMiniPlayerSpace = () => {
  const windowSize = useWindowSize()
  const isTablet = useIsTabletLayout()
  const height = isTablet
    ? (windowSize.width < TABLET_COMPACT_WIDTH ? TABLET_COMPACT_HEIGHT : TABLET_HEIGHT)
    : PHONE_HEIGHT
  return scaleSizeH(height) + scaleSizeH(MINI_MARGIN_Y)
}

const pushPlayDetail = () => {
  const componentId = commonState.componentIds.home
  if (componentId) navigations.pushPlayDetailScreen(componentId, false)
}

/** 细进度条：轨道 4、圆点 8，点击可跳转播放位置 */
const ThinProgress = memo(({ progress, height }: {
  progress: number
  /** 轨道高度（px） */
  height: number
}) => {
  const [width, setWidth] = useState(0)

  const handlePress = useCallback((e: { nativeEvent: { locationX: number } }) => {
    if (!width) return
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / width))
    const { maxPlayTime } = playerState.progress
    if (maxPlayTime > 0) global.app_event.setProgress(ratio * maxPlayTime)
  }, [width])

  const ratio = Math.max(0, Math.min(1, progress))

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={styles.progressWrap}
      onLayout={(e) => { setWidth(e.nativeEvent.layout.width) }}
    >
      <View style={{ ...styles.progressTrack, height }}>
        <View style={{ ...styles.progressBar, height, width: `${ratio * 100}%` }} />
      </View>
      <View style={{ ...styles.progressDot, left: `${ratio * 100}%` }} />
    </TouchableOpacity>
  )
})

/**
 * 手机档：封面 + 歌名/专辑 + 收藏/上一曲/播放/下一曲/播放列表。
 *
 * 整条都是热区（点空白处也能呼出播放页），内部按钮与细进度条自己吃掉手势，
 * 不会误触。
 */
const PhoneBar = memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()

  return (
    <Pressable style={{ ...styles.container, height: scaleSizeH(PHONE_HEIGHT) }} onPress={pushPlayDetail}>
      <View style={styles.info}>
        <SongThumb size={42} pic={musicInfo.pic} rounded={4} />
        <View style={styles.infoText}>
          <Text size={13} numberOfLines={1} color={REF_COLOR.text}>
            {musicInfo.name}{musicInfo.singer ? ` - ${musicInfo.singer}` : ''}
          </Text>
          <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.subTitle}>
            {musicInfo.album || musicInfo.singer || ''}
          </Text>
        </View>
      </View>
      <View style={styles.controls}>
        <LoveBtn iconType="mc" size={19} color={REF_COLOR.primary} />
        <TouchableOpacity style={styles.ctrlBtn} activeOpacity={0.5} onPress={() => { void playPrev() }}>
          <IconMC name="skip-previous" size={19} color={REF_COLOR.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} activeOpacity={0.7} onPress={togglePlay}>
          <IconMC name={isPlay ? 'pause' : 'play'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} activeOpacity={0.5} onPress={() => { void playNext() }}>
          <IconMC name="skip-next" size={19} color={REF_COLOR.primary} />
        </TouchableOpacity>
        <PlayListBtn iconType="mc" size={19} color={REF_COLOR.primary} toggle />
      </View>
    </Pressable>
  )
})

/**
 * 平板档：封面 → 上一曲 / 播放 / 下一曲 → 歌名+细进度条 → 时间 → 模式/收藏/列表。
 *
 * 尺寸全部走 `scaleSizeW/H`：槽宽、圆底、图标三者同一套缩放系数，
 * 避免出现「按钮按 dp 画、图标按平板系数放大」导致暂停键撑满圆底的问题。
 */
const TabletBar = memo(({ compact }: { compact: boolean }) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  // 必须订阅进度：`useProgress(false)` 不订阅 playProgressChanged，
  // 细进度条与时间会一直停在换歌那一刻的值
  const progress = useProgress()

  const height = compact ? TABLET_COMPACT_HEIGHT : TABLET_HEIGHT
  const thumbSize = compact ? 36 : 50
  const iconSize = compact ? 18 : 26
  const playIconSize = compact ? 22 : 30
  const titleSize = compact ? 16 : 19
  const playSize = scaleSizeW(compact ? 32 : 42)
  /**
   * 左侧三键之间补的空隙（设计值）。
   *
   * 右侧「模式 / 收藏 / 列表」是 36 的槽 + 图标，两个图标之间空 `36 − iconSize`
   * （完整档 10、紧凑档 18）。播放圆底比槽宽（42 / 32），会向两侧各溢出
   * `(playSize − 36) / 2`，正好把图标之间的空隙吃掉，看起来就比右侧挤。
   * 这里把它补回来：
   * `(36 − iconSize) / 2 + (playSize − 36) / 2`
   * 完整档 8、紧凑档 7 —— 两组**图标之间的空隙**才真正一致。
   */
  const ctrlGap = (TABLET_SLOT - iconSize) / 2 + ((compact ? 32 : 42) - TABLET_SLOT) / 2

  return (
    <Pressable style={{ ...styles.container, height: scaleSizeH(height) }} onPress={pushPlayDetail}>
      <SongThumb size={thumbSize} pic={musicInfo.pic} rounded={4} />
      <View style={{
        ...styles.tabletControls,
        columnGap: scaleSizeW(ctrlGap),
        marginLeft: scaleSizeW(compact ? 2 : 6),
        marginRight: scaleSizeW(compact ? 2 : 6),
      }}>
        <TouchableOpacity style={styles.slot} activeOpacity={0.5} onPress={() => { void playPrev() }}>
          <IconMC name="skip-previous" size={iconSize} color={REF_COLOR.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.slot} activeOpacity={0.7} hitSlop={scaleSizeW(3)} onPress={togglePlay}>
          <View style={{ ...styles.playBtn, width: playSize, height: playSize, borderRadius: playSize / 2 }}>
            <IconMC name={isPlay ? 'pause' : 'play'} size={playIconSize} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.slot} activeOpacity={0.5} onPress={() => { void playNext() }}>
          <IconMC name="skip-next" size={iconSize} color={REF_COLOR.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.tabletInfo}>
        <Text size={titleSize} numberOfLines={1} color={REF_COLOR.text}>
          {musicInfo.name}{musicInfo.singer ? ` - ${musicInfo.singer}` : ''}
        </Text>
        <ThinProgress progress={progress.progress} height={scaleSizeH(4)} />
      </View>
      <View style={styles.tabletRight}>
        {compact
          ? null
          : <Text size={15} color={REF_COLOR.textHint} style={styles.time}>{`${progress.nowPlayTimeStr}/${progress.maxPlayTimeStr}`}</Text>}
        <PlayModeBtn iconType="mc" size={iconSize} color={REF_COLOR.primary} />
        <LoveBtn iconType="mc" size={iconSize} color={REF_COLOR.primary} />
        <PlayListBtn iconType="mc" size={iconSize} color={REF_COLOR.primary} toggle />
      </View>
    </Pressable>
  )
})

export default memo(() => {
  const musicInfo = usePlayerMusicInfo()
  const windowSize = useWindowSize()
  const isTablet = useIsTabletLayout()
  const bottomOffset = useBottomBarHeight()

  const compact = useMemo(() => windowSize.width < TABLET_COMPACT_WIDTH, [windowSize.width])

  if (!musicInfo.id) return null

  return (
    <View style={{ ...styles.wrap, bottom: bottomOffset }}>
      <View style={styles.card}>
        {isTablet ? <TabletBar compact={compact} /> : <PhoneBar />}
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginHorizontal: scaleSizeW(8),
    marginBottom: 6,
    marginTop: 2,
  },
  card: {
    backgroundColor: REF_COLOR.cardBgAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(49, 194, 124, 0.28)',
    overflow: 'hidden',
    elevation: 6,
  },
  container: {
    width: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flexGrow: 1,
    flexShrink: 1,
    marginLeft: 8,
  },
  subTitle: {
    marginTop: 2,
  },
  controls: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabletControls: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabletInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 10,
  },
  tabletRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    marginRight: 8,
  },
  ctrlBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 平板三键的槽：宽 36，与右侧 ActionBtn 一致 */
  slot: {
    width: TABLET_SLOT,
    height: TABLET_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: scaleSizeW(19),
    backgroundColor: REF_COLOR.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    height: scaleSizeH(12),
    justifyContent: 'center',
    marginTop: 3,
  },
  progressTrack: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: REF_COLOR.pillActive,
    overflow: 'hidden',
  },
  progressBar: {
    borderRadius: 4,
    backgroundColor: REF_COLOR.primary,
  },
  progressDot: {
    position: 'absolute',
    width: scaleSizeW(8),
    height: scaleSizeW(8),
    borderRadius: scaleSizeW(4),
    backgroundColor: REF_COLOR.primary,
  },
})
