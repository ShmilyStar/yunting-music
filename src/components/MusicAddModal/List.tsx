import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useMyList } from '@/store/list/hook'
import { LIST_IDS } from '@/config/constant'
import ListItem, { styles as listStyles } from './ListItem'
import CreateUserList from './CreateUserList'
import { useWindowSize } from '@/utils/hooks'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

const styles = createStyle({
  list: {
    paddingLeft: 15,
    paddingRight: 2,
    paddingBottom: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // backgroundColor: 'rgba(0,0,0,0.2)'
    // justifyContent: 'center',
  },
})
const MIN_WIDTH = scaleSizeW(150)
const PADDING = styles.list.paddingLeft + styles.list.paddingRight


const EditListItem = ({ itemWidth }: {
  itemWidth: number
}) => {
  const [isEdit, setEdit] = useState(false)
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={{ ...listStyles.listItem, width: itemWidth }}>
      <TouchableOpacity
        style={{ ...listStyles.button, borderColor: theme['c-primary-light-200-alpha-700'], borderStyle: 'dashed' }}
        onPress={() => { setEdit(true) }}
      >
        <Text style={{ opacity: isEdit ? 0 : 1 }} numberOfLines={1} size={14} color={theme['c-button-font']}>{t('list_create')}</Text>
      </TouchableOpacity>
      {
        isEdit
          ? <CreateUserList isEdit={isEdit} onHide={() => { setEdit(false) }} />
          : null
      }
    </View>
  )
}

export default ({ musicInfo, onPress }: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const windowSize = useWindowSize()
  const allList = useMyList()
  /**
   * 弹窗里只放「我的收藏」和用户新建的列表，**不显示试听列表**（`LIST_IDS.TEMP`），
   * 也不显示从「发现 → 歌单」收藏来的歌单（带 `sourceListId`）。
   */
  const sourceLists = useMemo(
    () => allList.filter(info =>
      info.id == LIST_IDS.LOVE ||
      (info.id != LIST_IDS.TEMP && info.id != LIST_IDS.DEFAULT && !(info as { sourceListId?: string }).sourceListId),
    ),
    [allList],
  )
  const itemWidth = useMemo(() => {
    let w = Math.floor(windowSize.width * 0.9 - PADDING)
    let n = Math.floor(w / MIN_WIDTH)
    if (n > 10) n = 10
    return Math.floor((w - 1) / n)
  }, [windowSize])

  return (
    <ScrollView style={{ flexGrow: 0 }}>
      <View style={styles.list} onStartShouldSetResponder={() => true}>
        { sourceLists.map(info => <ListItem key={info.id} listInfo={info} musicInfo={musicInfo} onPress={onPress} width={itemWidth} />) }
        <EditListItem itemWidth={itemWidth} />
      </View>
    </ScrollView>
  )
}
