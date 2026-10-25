import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, View, TouchableOpacity, Animated } from 'react-native'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { type Lines } from 'lrc-file-parser'
import { useTheme } from '@/store/theme/hook'
import { BorderWidths } from '@/theme'
import { formatPlayTime2 } from '@/utils'
import { Icon } from '@/components/common/Icon'
import { offsetToLyricTime, LYRIC_PLAY_LINE_TOP, type LyricLayoutInfo } from './lyricLayout'


export interface PlayLineType {
  updateScrollInfo: (scrollInfo: NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null) => void
  updateLayoutInfo: (listLayoutInfo: LyricLayoutInfo) => void
  updateLyricLines: (lyricLines: Lines) => void
  setVisible: (visible: boolean) => void
}

export interface PlayLineProps {
  onPlayLine: (time: number) => void
}

/**
 * 当前播放行对应的播放时间（ms）。
 *
 * 拖拽歌词调整进度只需要取这个值（见两个歌词组件的 `onScrollEndDrag`），
 * 不必挂组件；与 `PlayLine` 显示的标签、点击跳转用的是同一套换算。
 */
export const getLyricPlayTime = (
  scrollInfo: NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null,
  layout: LyricLayoutInfo,
  lines: Lines,
) => {
  if (!scrollInfo) return null
  return offsetToLyricTime(
    scrollInfo.contentOffset.y,
    scrollInfo.layoutMeasurement.height,
    layout,
    lines,
  )
}

const ANIMATION_DURATION = 300

export default forwardRef<PlayLineType, PlayLineProps>(({ onPlayLine }, ref) => {
  const theme = useTheme()
  const [scrollInfo, setScrollInfo] = useState<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const [listLayoutInfo, setListLayoutInfo] = useState<LyricLayoutInfo>({ spaceHeight: 0, lineHeights: [] })
  const [lyricLines, setLyricLines] = useState<Lines>([])
  const [visible, setVisible] = useState(false)
  const opsAnim = useRef<Animated.Value>(
    new Animated.Value(0),
  ).current

  const setShow = (visible: boolean) => {
    Animated.timing(opsAnim, {
      toValue: visible ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) setVisible(false)
    })
  }

  useImperativeHandle(ref, () => ({
    updateScrollInfo(scrollInfo) {
      setScrollInfo(scrollInfo)
    },
    updateLayoutInfo(listLayoutInfo) {
      setListLayoutInfo(listLayoutInfo)
    },
    updateLyricLines(lyricLines) {
      setLyricLines(lyricLines)
    },
    setVisible(visible) {
      if (visible) {
        setVisible(true)
      }
      requestAnimationFrame(() => {
        setShow(visible)
      })
      // setVisible()
    },
  }))

  const handlePlayLine = () => {
    onPlayLine(time / 1000)
  }

  if (!scrollInfo || !visible) return null
  const time = getLyricPlayTime(scrollInfo, listLayoutInfo, lyricLines) ?? 0
  const timeLabel = formatPlayTime2(time / 1000)
  return (
    <Animated.View style={{ ...styles.playLine, top: LYRIC_PLAY_LINE_TOP, opacity: opsAnim }}>
      <Text style={styles.label} color={theme['c-primary-font']} size={13}>{timeLabel}</Text>
      <View style={styles.lineContent}>
        <View style={{ ...styles.line, borderBottomColor: theme['c-primary-alpha-700'] }} />
        <TouchableOpacity style={styles.button} onPress={handlePlayLine}>
          <Icon name="play" color={theme['c-button-font']} size={18} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
})

const styles = createStyle({
  playLine: {
    position: 'absolute',
    width: '100%',
    // top 由 LYRIC_PLAY_LINE_TOP 给出：与换算用的比例同一个数
    left: 0,
    height: 2,
    // paddingTop: 5,
    // paddingBottom: 5,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  label: {
    position: 'absolute',
    right: 45,
    bottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lineContent: {
    // backgroundColor: 'rgba(0,0,0,0.1)',
    position: 'absolute',
    width: '100%',
    height: 20,
    top: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  line: {
    marginLeft: 30,
    borderBottomWidth: BorderWidths.normal2,
    borderStyle: 'dashed',
    flex: 1,
  },
  button: {
    flex: 0,
    paddingLeft: 5,
    paddingRight: 15,
  },
})
