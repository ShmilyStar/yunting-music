import { memo, useCallback } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import IconMC from '@/components/common/IconMC'
import { ActionBtn, PlayListBtn, PlayModeBtn, type ActionIconType } from '@/components/player/ActionBtns'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

/**
 * 控制行尺寸（05 §13）。
 *
 * icomoon（平板/宽屏）的字形可见范围接近字号，MCI 只有字号的一半左右，
 * 所以 MCI 那套字号明显更大，两套不能混用同一个数值。
 */
const MC_SIZE = { icon: 32, mode: 30, list: 30, play: 38 } as const
const ICO_SIZE = { icon: 24, mode: 26, list: 26, play: 30 } as const
/** 播放键圆底直径（两套通用） */
const PLAY_SIZE = 52

/** 同一个语义在两套图标集里的字形名（控制行专用：ActionBtns 的 ICON_NAME 不含上一曲/下一曲/播放） */
const ICON_NAME = {
  prev: { mc: 'skip-previous', icomoon: 'prevMusic' },
  next: { mc: 'skip-next', icomoon: 'nextMusic' },
  play: { mc: 'play', icomoon: 'play' },
  pause: { mc: 'pause', icomoon: 'pause' },
} as const

const Glyph = ({ mc, icomoon, iconType, size, color }: {
  mc: string
  icomoon: string
  iconType: ActionIconType
  size: number
  color?: string
}) => iconType == 'mc'
  ? <IconMC name={mc} size={size} color={color} />
  : <Icon name={icomoon} size={size} color={color} />

/**
 * 控制行：播放模式 · 上一曲 · 播放/暂停 · 下一曲 · 播放列表。
 *
 * 手机传 `iconType="mc"`，平板/宽屏传 `icomoon`（02 §7.6）。
 */
export default memo(({ iconType = 'mc' }: { iconType?: ActionIconType }) => {
  const theme = useTheme()
  const isPlay = useIsPlay()
  const size = iconType == 'mc' ? MC_SIZE : ICO_SIZE
  const color = theme['c-font']

  const handlePlayPrev = useCallback(() => {
    void playPrev()
  }, [])
  const handlePlayNext = useCallback(() => {
    void playNext()
  }, [])

  return (
    <View style={styles.container}>
      <PlayModeBtn iconType={iconType} size={size.mode} color={color} />
      <ActionBtn onPress={handlePlayPrev}>
        <Glyph {...ICON_NAME.prev} iconType={iconType} size={size.icon} color={color} />
      </ActionBtn>
      <TouchableOpacity style={styles.playBtn} activeOpacity={0.7} onPress={togglePlay}>
        <Glyph
          mc={isPlay ? ICON_NAME.pause.mc : ICON_NAME.play.mc}
          icomoon={isPlay ? ICON_NAME.pause.icomoon : ICON_NAME.play.icomoon}
          iconType={iconType}
          size={size.play}
          color="#FFFFFF"
        />
      </TouchableOpacity>
      <ActionBtn onPress={handlePlayNext}>
        <Glyph {...ICON_NAME.next} iconType={iconType} size={size.icon} color={color} />
      </ActionBtn>
      <PlayListBtn iconType={iconType} size={size.list} color={color} toggle />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 行宽必须撑满父容器，否则 space-between 失效、图标会挤在左侧
    flexGrow: 1,
    flexShrink: 1,
  },
  playBtn: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    // borderRadius 不在 createStyle 的自动表里，全圆要手写
    borderRadius: scaleSizeW(PLAY_SIZE / 2),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: REF_COLOR.primary,
  },
})
