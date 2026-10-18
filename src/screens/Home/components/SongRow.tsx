import { memo, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongThumb from '@/components/common/SongThumb'
import { REF_COLOR, REF_ACCENT } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'

export interface SongRowProps {
  /** 序号，从 1 开始；不传则不显示 */
  index?: number
  name: string
  singer?: string
  album?: string
  /** 音质标签（SQ / 24bit 等） */
  quality?: string
  /** 时长文案（03:28） */
  duration?: string
  pic?: string | null
  /** 传进来后，`pic` 为空时缩略图会自己按需取一次封面 */
  musicInfo?: LX.Music.MusicInfo | null
  active?: boolean
  onPress?: () => void
  /** ⋯ 菜单键：回调带上按键在屏幕上的位置，供 Menu 定位 */
  onMore?: (position: { x: number, y: number, w: number, h: number }) => void
}

/**
 * 歌曲行（榜单歌曲 / 歌单详情 / 最近播放 / 分类列表共用）：
 * 序号 + 缩略图 + 歌名 + 「音质 + 歌手」 + 时长 + ⋯
 */
export const SongRow = memo(({
  index, name, singer, album, quality, duration, pic, musicInfo, active, onPress, onMore,
}: SongRowProps) => {
  const theme = useTheme()
  const primary = theme['c-primary']
  const moreRef = useRef<TouchableOpacity>(null)

  const handleMore = () => {
    if (moreRef.current?.measure) {
      moreRef.current.measure((_fx, _fy, width, height, px, py) => {
        onMore?.({ x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.main} activeOpacity={0.7} onPress={onPress}>
        {index != null
          ? <Text style={styles.index} size={12} color={active ? primary : REF_COLOR.textHint}>{index}</Text>
          : null}
        <SongThumb size={42} pic={pic} musicInfo={musicInfo} />
        <View style={styles.info}>
          <Text size={14} numberOfLines={1} color={active ? primary : REF_COLOR.text}>{name}</Text>
          <View style={styles.subRow}>
            {quality
              ? <Text size={11} color={REF_ACCENT.blue.color} style={styles.quality}>{quality}</Text>
              : null}
            <Text size={11} numberOfLines={1} color={REF_COLOR.textHint} style={styles.sub}>
              {[singer, album].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        {duration
          ? <Text size={11} color={REF_COLOR.textHint} style={styles.duration}>{duration}</Text>
          : null}
      </TouchableOpacity>
      {onMore
        ? (
            <TouchableOpacity ref={moreRef} style={styles.more} activeOpacity={0.5} onPress={handleMore}>
              <IconMC name="dots-vertical" size={18} color={REF_COLOR.textHint} />
            </TouchableOpacity>
          )
        : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: REF_COLOR.divider,
  },
  main: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  index: {
    width: 26,
    textAlign: 'center',
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  quality: {
    marginRight: 6,
  },
  sub: {
    flexGrow: 1,
    flexShrink: 1,
  },
  duration: {
    marginLeft: 8,
  },
  more: {
    width: scaleSizeW(38),
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default SongRow
