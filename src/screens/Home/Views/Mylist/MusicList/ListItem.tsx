import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { LIST_ITEM_HEIGHT } from '@/config/constant'
// import { BorderWidths } from '@/theme'
import IconMC from '@/components/common/IconMC'
import { createStyle, type RowInfo } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useAssertApiSupport } from '@/store/common/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import Text from '@/components/common/Text'
import Badge from '@/components/common/Badge'
import SongThumb from '@/components/common/SongThumb'
import { REF_COLOR } from '@/config/uiPalette'

export const ITEM_HEIGHT = scaleSizeH(LIST_ITEM_HEIGHT)


export default memo(({ item, index, activeIndex, onPress, onShowMenu, onLongPress, selectedList, rowInfo, isShowAlbumName, isShowInterval }: {
  item: LX.Music.MusicInfo
  index: number
  activeIndex: number
  onPress: (item: LX.Music.MusicInfo, index: number) => void
  onLongPress: (item: LX.Music.MusicInfo, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void
  selectedList: LX.Music.MusicInfo[]
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
}) => {
  const theme = useTheme()

  const isSelected = selectedList.includes(item)
  // console.log(item.name, selectedList, selectedList.includes(item))
  const isSupported = useAssertApiSupport(item.source)
  const moreButtonRef = useRef<TouchableOpacity>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  const active = activeIndex == index

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` · ${item.meta.albumName}` : ''}`

  return (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)', opacity: isSupported ? 1 : 0.5 }}>
      <TouchableOpacity style={styles.listItemLeft} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
        {
          active
            ? <IconMC style={styles.sn} name="play" size={13} color={theme['c-primary']} />
            : <Text style={styles.sn} size={12} color={REF_COLOR.textHint}>{index + 1}</Text>
        }
        {/* 列表行前的封面缩略图：取不到时按需拉一次，本地歌/取不到则显示占位图标 */}
        <SongThumb size={40} pic={item.meta?.picUrl ?? null} musicInfo={item} />
        <View style={styles.itemInfo}>
          {/* <View style={styles.listItemTitle}> */}
          <Text size={14} color={active ? theme['c-primary'] : REF_COLOR.text} numberOfLines={1}>{item.name}</Text>
          {/* </View> */}
          <View style={styles.listItemSingle}>
            <Badge>{item.source.toUpperCase()}</Badge>
            <Text style={styles.listItemSingleText} size={11} color={REF_COLOR.textHint} numberOfLines={1}>
              {singer}
            </Text>
          </View>
        </View>
        {
          isShowInterval ? (
            <Text size={11} color={REF_COLOR.textHint} numberOfLines={1}>{item.interval}</Text>
          ) : null
        }
      </TouchableOpacity>
      {/* <View style={styles.listItemRight}> */}
      <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
        <IconMC name="dots-vertical" color={REF_COLOR.textHint} size={18} />
      </TouchableOpacity>
      {/* </View> */}
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
    prevProps.isShowInterval === nextProps.isShowInterval &&
    prevProps.activeIndex != nextProps.index &&
    nextProps.activeIndex != nextProps.index &&
    nextProps.selectedList.includes(nextProps.item) == prevProps.selectedList.includes(prevProps.item)
  )
})


const styles = createStyle({
  listItem: {
    // width: '50%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    // paddingLeft: 10,
    paddingRight: 2,
    alignItems: 'center',
    // borderBottomWidth: BorderWidths.normal,
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  sn: {
    width: 26,
    // fontSize: 12,
    textAlign: 'center',
    // backgroundColor: 'rgba(0,0,0,0.2)',
    paddingLeft: 3,
    paddingRight: 3,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    // paddingTop: 10,
    // paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 2,
  },
  // listItemTitle: {
  //   flexGrow: 0,
  //   flexShrink: 1,
  // },
  listItemSingle: {
    paddingTop: 3,
    flexDirection: 'row',
    // alignItems: 'flex-end',
  },
  listItemSingleText: {
    // backgroundColor: 'rgba(0,0,0,0.2)',
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
    // fontSize: 15,
  },
  // listItemBadge: {
  //   // fontSize: 10,
  //   paddingLeft: 5,
  //   paddingTop: 2,
  //   alignSelf: 'flex-start',
  // },
  listItemRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    justifyContent: 'center',
  },

  moreButton: {
    height: '80%',
    paddingLeft: 14,
    paddingRight: 14,
    // paddingTop: 10,
    // paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
  },
})
