import { memo, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import SongThumb from '@/components/common/SongThumb'
import { REF_COLOR, REF_ACCENT } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'

export interface SongRowProps {
  /** 序号，从 1 开始；不传则不显示 */
  index?: number
  /**
   * 行下标（0 基）。点行 / 点 ⋯ 时随回调回传，父级就不必为每一行新建闭包，
   * `memo` 才有意义（列表上千行时差别明显）。
   */
  rowIndex?: number
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
  /** 传了 `musicId` 时行内自己订阅「当前播放」判断高亮，父级 renderItem 不必依赖 currentId */
  musicId?: string
  active?: boolean
  onPress?: () => void
  /** 优先于 `onPress`：回传行下标 */
  onPressItem?: (rowIndex: number) => void
  /** ⋯ 菜单键：回调带上按键在屏幕上的位置，供 Menu 定位 */
  onMore?: (position: { x: number, y: number, w: number, h: number }) => void
  /** 优先于 `onMore`：回传行下标 */
  onMoreItem?: (rowIndex: number, position: { x: number, y: number, w: number, h: number }) => void
}

/**
 * 歌曲行（榜单歌曲 / 歌单详情 / 最近播放 / 分类列表共用）：
 * 序号 + 缩略图 + 歌名 + 「音质 + 歌手」 + 时长 + ⋯
 */
export const SongRow = memo(({
  index, rowIndex, name, singer, album, quality, duration, pic, musicInfo, musicId,
  active, onPress, onPressItem, onMore, onMoreItem,
}: SongRowProps) => {
  const theme = useTheme()
  const primary = theme['c-primary']
  const moreRef = useRef<TouchableOpacity>(null)
  const playMusicInfo = usePlayMusicInfo()
  // 没显式给 active 时按「当前播放」自行判断，父级就不必把 currentId 塞进依赖
  const isActive = active ?? (musicId != null && playMusicInfo.musicInfo?.id == musicId)

  const handleMore = () => {
    if (moreRef.current?.measure) {
      moreRef.current.measure((_fx, _fy, width, height, px, py) => {
        const position = { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) }
        if (onMoreItem && rowIndex != null) onMoreItem(rowIndex, position)
        else onMore?.(position)
      })
    }
  }

  const handlePress = onPressItem && rowIndex != null ? () => { onPressItem(rowIndex) } : onPress

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.main} activeOpacity={0.7} onPress={handlePress}>
        {index != null
          ? <Text style={styles.index} size={12} color={isActive ? primary : REF_COLOR.textHint}>{index}</Text>
          : null}
        <SongThumb size={42} pic={pic} musicInfo={musicInfo} />
        <View style={styles.info}>
          <Text size={14} numberOfLines={1} color={isActive ? primary : REF_COLOR.text}>{name}</Text>
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
    // 双列（平板 / 横屏）时两列等分宽度：不加 flexGrow 会全部挤在第一列
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    // 右侧没有「⋯」按钮时要留出边距，否则时长 / 唱片标签会顶到屏幕边缘被裁掉
    paddingRight: 12,
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
    flexGrow: 0,
    flexShrink: 0,
  },
  more: {
    width: scaleSizeW(38),
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    // 有「⋯」时它自己撑住右侧，抵消上面的 paddingRight，保持视觉对齐
    marginRight: -scaleSizeW(12),
  },
})

export default SongRow
