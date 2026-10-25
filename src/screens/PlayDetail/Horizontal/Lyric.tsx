import { memo, useMemo, useEffect, useRef, useCallback } from 'react'
import { View, FlatList, type FlatListProps, type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
// import { useComponentIds } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import { lrcFontSizeFromSetting } from '@/screens/PlayDetail/lrcFontSize'
import playerState from '@/store/player/state'
import { scrollTo } from '@/utils/scroll'
import PlayLine, { type PlayLineType, getLyricPlayTime } from '../components/PlayLine'
// import { screenkeepAwake } from '@/utils/nativeModules/utils'
// import { log } from '@/utils/log'
// import { toast } from '@/utils/tools'

type FlatListType = FlatListProps<Line>

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
}
const LrcLine = memo(({ line, lineNum, activeLine, onLayout }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.horizontal.style.lrcFontSize')
  // 歌词一律居中：「歌词对齐方式」设置项已删除（01 §2.10）
  const textAlign = 'center' as const
  const size = lrcFontSizeFromSetting(lrcFontSize)
  const lineHeight = setSpText(size) * 1.3

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    return active ? [
      theme['c-primary'],
      theme['c-primary-alpha-200'],
      1,
    ] as const : [
      theme['c-350'],
      theme['c-300'],
      0.6,
    ] as const
  }, [activeLine, lineNum, theme])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }

  // textBreakStrategy="simple" 用于解决某些设备上字体被截断的问题
  // https://stackoverflow.com/a/72822360
  return (
    <View style={styles.line} onLayout={handleLayout}>
      <AnimatedColorText style={{
        ...styles.lineText,
        textAlign,
        lineHeight,
      }} textBreakStrategy="simple" color={colors[0]} opacity={colors[2]} size={size}>{line.text}</AnimatedColorText>
      {
        line.extendedLyrics.map((lrc, index) => {
          return (<AnimatedColorText style={{
            ...styles.lineTranslationText,
            textAlign,
            lineHeight: lineHeight * 0.8,
          }} textBreakStrategy="simple" key={index} color={colors[1]} opacity={colors[2]} size={size * 0.8}>{lrc}</AnimatedColorText>)
        })
      }
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.line === nextProps.line &&
    prevProps.activeLine != nextProps.lineNum &&
    nextProps.activeLine != nextProps.lineNum
})
const sameTrack = (a: LX.Player.PlayMusicInfo['musicInfo'] | null, b: LX.Player.PlayMusicInfo['musicInfo'] | null) => {
  if (a == b) return true
  if (a == null || b == null) return false
  return ('progress' in a ? a.metadata.musicInfo.id : a.id) === ('progress' in b ? b.metadata.musicInfo.id : b.id)
}

/**
 * 把第一句放到列表中间（横屏 = 可视高度的 42% 处）。
 *
 * 列表头尾各有一块 `paddingTop: '100%'` 的占位，第一句居中对应的偏移
 * 就近似占位块高度。直接 `scrollToOffset`：新歌词的 `onLayout` 还没
 * 回来，行高数组是空的，按行高累加会算出 0。
 */
const putFirstLineInCenter = (list: FlatList<Line> | FlatList, info: { spaceHeight: number }) => {
  try {
    list.scrollToOffset({ offset: Math.max(info.spaceHeight * 0.42, 0), animated: false })
  } catch {}
}

// 自动跟随滚动的兜底等待：列表滚动被用户手势接管时，带目标行的
// 定位会被丢弃，等 600ms 让手势结束后再补一次
const AUTO_SCROLL_DELAY = 600
// 手动滑动锁定的兜底时长：松手时若没有惯性，`onMomentumScrollEnd`
// 不会触发，由它解锁（正常情况下惯性一停就解锁）
const SCROLL_LOCK_FALLBACK_DELAY = 3000

const wait = async() => new Promise(resolve => setTimeout(resolve, 100))

export default () => {
  const lyricLines = useLrcSet()
  const { line } = useLrcPlay()
  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(true)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef({ line: 0, prevLine: 0 })
  const isFirstSetLrc = useRef(true)
  const scrollInfoRef = useRef<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const listLayoutInfoRef = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  // 供 `applyScrollTime` 读取最新歌词（它不在渲染闭包里调用）
  const lyricLinesRef = useRef(lyricLines)
  lyricLinesRef.current = lyricLines
  const scrollCancelRef = useRef<(() => void) | null>(null)
  // 上一次渲染时的播放歌曲：用来区分「换歌」与「同一首歌内跳转」
  const trackRef = useRef<LX.Player.PlayMusicInfo['musicInfo'] | null>(playerState.playMusicInfo.musicInfo)
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')
  // 手动滑动是否要改播放进度（「允许通过拖拽歌词调整播放进度」设置项）
  const isSeekByDragRef = useRef(isShowLyricProgressSetting)
  isSeekByDragRef.current = isShowLyricProgressSetting
  // useLock()
  // const [imgUrl, setImgUrl] = useState(null)
  // const theme = useGetter('common', 'theme')
  // const { onLayout, ...layout } = useLayout()

  // useEffect(() => {
  //   const url = playMusicInfo ? playMusicInfo.musicInfo.img : null
  //   if (imgUrl == url) return
  //   setImgUrl(url)
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [playMusicInfo])

  // const imgWidth = useMemo(() => layout.width * 0.75, [layout.width])
  const handleScrollToActive = (index = lineRef.current.line) => {
    if (index < 0) return
    if (flatListRef.current) {
      if (scrollInfoRef.current && lineRef.current.line - lineRef.current.prevLine == 1) {
        let offset = listLayoutInfoRef.current.spaceHeight
        for (let line = 0; line < index; line++) {
          offset += listLayoutInfoRef.current.lineHeights[line]
        }
        offset += (listLayoutInfoRef.current.lineHeights[line] ?? 0) / 2
        try {
          scrollCancelRef.current = scrollTo(flatListRef.current, scrollInfoRef.current, offset - scrollInfoRef.current.layoutMeasurement.height * 0.42, 600, () => {
            scrollCancelRef.current = null
          })
        } catch {}
      } else {
        if (scrollCancelRef.current) {
          scrollCancelRef.current()
          scrollCancelRef.current = null
        }
        try {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.42,
          })
        } catch {}
      }
    }
  }

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfoRef.current = nativeEvent
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
    }
  }
  const handleScrollBeginDrag = () => {
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
  }

  /**
   * 结束手动滑动：解除自动跟随锁定。
   *
   * 锁定期间播放行变化完全不滚动，所以这里只负责解锁，不立刻回位——
   * 用户滑过去看的那几句不会被瞬间拽走
   */
  const unlockScroll = useCallback(() => {
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
    isPauseScrollRef.current = false
  }, [])

  /**
   * 把「当前滚动到的歌词位置」换算成播放时间并跳过去。
   *
   * 「允许通过拖拽歌词调整播放进度」设置项打开时，用户手动滑动歌词
   * 就是在选播放位置：松手 / 惯性停稳后按播放行处的那一句（句内按比例
   * 插值）设置进度。关掉该选项时滑动只是浏览歌词，不动播放位置。
   */
  const applyScrollTime = useCallback(() => {
    if (!isSeekByDragRef.current) return
    const time = getLyricPlayTime(
      scrollInfoRef.current,
      listLayoutInfoRef.current,
      lyricLinesRef.current,
    )
    if (time == null) return
    global.app_event.setProgress(time)
  }, [])

  const onScrollEndDrag = () => {
    if (!isPauseScrollRef.current) return
    // 有惯性时由 `onMomentumScrollEnd` 停稳后解锁，没有惯性时由兜底计时器
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(unlockScroll, SCROLL_LOCK_FALLBACK_DELAY)
    // 松手即应用：拖拽调整播放进度不能等惯性停下来
    applyScrollTime()
  }

  // 惯性滚动结束：立即解锁
  const handleMomentumScrollEnd = () => {
    if (!isPauseScrollRef.current) return
    if (scrollCancelRef.current) {
      scrollCancelRef.current()
      scrollCancelRef.current = null
    }
    // 惯性会把列表再带一段：停稳后按最终位置再应用一次
    applyScrollTime()
    unlockScroll()
  }


  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // linesRef.current = lyricLines
    listLayoutInfoRef.current.lineHeights = []
    // 行号以最新歌词为准：定位基准归到「第一句」（-1 表示还没播过），
    // 后面的播放行相对它就会被判成「跳跃」直接定位，不必等 600ms 定时器
    lineRef.current.prevLine = -1
    lineRef.current.line = 0
    if (!flatListRef.current) return
    flatListRef.current.scrollToOffset({
      offset: 0,
      animated: false,
    })
    if (!lyricLines.length) return
    trackRef.current = playerState.playMusicInfo.musicInfo
    playLineRef.current?.updateLyricLines(lyricLines)
    requestAnimationFrame(() => {
      // 歌词换了（换歌 / 开关翻译 / 修正后的歌词）就解除手动滑动锁定，
      // 让播放行重新接管滚动
      isPauseScrollRef.current = false
      if (isFirstSetLrc.current) {
        isFirstSetLrc.current = false
        // 与 else 分支一致：用 delayScrollTimeout 跟踪，卸载/重设时可清
        if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = setTimeout(() => {
          handleScrollToActive()
        }, 100)
      } else {
        if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = setTimeout(() => {
          handleScrollToActive(0)
        }, 100)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricLines])

  useEffect(() => {
    if (line < 0) return
    const prevLine = lineRef.current.line
    lineRef.current.prevLine = prevLine
    lineRef.current.line = line
    // 换歌：新歌的歌词内容随 `lyricLines` 一起换掉，定位交给上面那个
    // effect。以前这里会拿新歌的播放行去量「行号差」，把换歌当成一次
    // 大跳跃处理
    if (!sameTrack(trackRef.current, playerState.playMusicInfo.musicInfo)) {
      trackRef.current = playerState.playMusicInfo.musicInfo
      if (flatListRef.current) putFirstLineInCenter(flatListRef.current, listLayoutInfoRef.current)
      return
    }
    if (!flatListRef.current) return

    // seek（拖动进度条 / 点歌词行 / 线控）引起的行号大跳：用户的显式
    // 操作优先于手动滑动锁定，否则歌词会停在之前滑到的位置
    if (prevLine >= 0 && Math.abs(line - prevLine) > 1) {
      isPauseScrollRef.current = false
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
    }
    if (isPauseScrollRef.current) return

    if (line - prevLine != 1) {
      handleScrollToActive()
      return
    }

    delayScrollTimeout.current = setTimeout(() => {
      delayScrollTimeout.current = null
      handleScrollToActive()
    }, AUTO_SCROLL_DELAY)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])

  useEffect(() => {
    requestAnimationFrame(() => {
      playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
      playLineRef.current?.updateLyricLines(lyricLines)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowLyricProgressSetting])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = (info) => {
    void wait().then(() => {
      handleScrollToActive(info.index)
    })
  }

  const handleLineLayout = useCallback<LineProps['onLayout']>((lineNum, height) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handlePlayLine = useCallback((time: number) => {
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [])

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    return (
      <LrcLine line={item} lineNum={index} activeLine={line} onLayout={handleLineLayout} />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  const spaceComponent = useMemo(() => (
    <View style={styles.space} onLayout={handleSpaceLayout}></View>
  ), [handleSpaceLayout])

  return (
    <>
      <FlatList
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={styles.container}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        fadingEdgeLength={100}
        // 固定小值：恢复播放时当前行可能有几百，按 line 算会首帧渲染几百行。
        // 首屏定位交给 scrollToIndex / onScrollToIndexFailed
        initialNumToRender={16}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
      />
      { isShowLyricProgressSetting ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null }
    </>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  space: {
    paddingTop: '100%',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
    // opacity: 0,
  },
  lineText: {
    textAlign: 'center',
    // fontSize: 16,
    // lineHeight: 20,
    // paddingTop: 5,
    // paddingBottom: 5,
    // opacity: 0,
  },
  lineTranslationText: {
    textAlign: 'center',
    // fontSize: 13,
    // lineHeight: 17,
    paddingTop: 5,
    // paddingBottom: 5,
  },
})
