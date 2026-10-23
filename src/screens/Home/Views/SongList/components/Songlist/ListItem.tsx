import { memo } from 'react'
import { View, Platform, TouchableOpacity } from 'react-native'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import { REF_COLOR } from '@/config/uiPalette'
import Image from '@/components/common/Image'

export default memo(({ item, index, width, showSource, onPress }: {
  item: ListInfoItem
  index: number
  showSource: boolean
  /** 由列表按「(宽度 − 间距) / 列数」算好，卡片刻度即此值 */
  width: number
  onPress: (item: ListInfoItem, index: number) => void
}) => {
  const theme = useTheme()
  const handlePress = () => {
    onPress(item, index)
  }
  return (
    item.source
      ? (
          <View style={{ ...styles.listItem, width }}>
            <View style={{ ...styles.listItemImg, backgroundColor: theme['c-content-background'] }}>
              <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
                <Image url={item.img} nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`} style={{ width, height: width, borderRadius: 6 }} />
                { showSource ? <Text style={styles.sourceLabel} size={9} color="#fff" >{item.source}</Text> : null }
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
              <Text style={styles.listItemTitle} size={12} color={REF_COLOR.text} numberOfLines={ 2 }>{item.name}</Text>
            </TouchableOpacity>
            {/* <Text>{JSON.stringify(item)}</Text> */}
          </View>
        )
      : <View style={{ ...styles.listItem, width }} />
  )
})

const styles = createStyle({
  listItem: {
    // width: 90,
    marginBottom: 12,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    borderRadius: 6,
    marginBottom: 5,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sourceLabel: {
    paddingLeft: 4,
    paddingBottom: 2,
    paddingRight: 4,
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  listItemTitle: {
    // overflow: 'hidden',
    lineHeight: 15,
  },
})
