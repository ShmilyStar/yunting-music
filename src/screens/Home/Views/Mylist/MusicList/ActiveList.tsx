import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { useActiveListId, useListFetching } from '@/store/list/hook'
import listState from '@/store/list/state'
import { createStyle } from '@/utils/tools'
import { getListPrevSelectId } from '@/utils/data'
import { setActiveList } from '@/core/list'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { LIST_IDS } from '@/config/constant'
import { REF_COLOR } from '@/config/uiPalette'
import Loading from '@/components/common/Loading'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

export interface ActiveListProps {
  onShowSearchBar: () => void
  onScrollToTop: () => void
}
export interface ActiveListType {
  setVisibleBar: (visible: boolean) => void
}

/**
 * 收藏页的列表信息条：列表名 + 搜索。
 *
 * 「收藏夹列表」的打开入口由外层标题栏的右侧插槽提供
 * （`global.app_event.changeLoveListVisible(true)`），这里**不再放重复入口**；
 * 长按列表名保留「回到当前播放曲目位置」。
 */
export default forwardRef<ActiveListType, ActiveListProps>(({ onShowSearchBar, onScrollToTop }, ref) => {
  const theme = useTheme()
  const currentListId = useActiveListId()
  const fetching = useListFetching(currentListId)
  const langId = useSettingValue('common.langId')
  const currentListName = useMemo(() => {
    switch (currentListId) {
      case LIST_IDS.TEMP:
        return global.i18n.t('list_name_temp')
      case LIST_IDS.DEFAULT:
        return global.i18n.t('list_name_default')
      case LIST_IDS.LOVE:
        return global.i18n.t('list_name_love')
      default:
        return listState.allList.find(l => l.id === currentListId)?.name ?? ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListId, langId])
  const [visibleBar, setVisibleBar] = useState(true)

  useImperativeHandle(ref, () => ({
    setVisibleBar(visible) {
      setVisibleBar(visible)
    },
  }))

  useEffect(() => {
    void getListPrevSelectId().then((id) => {
      setActiveList(id)
    })
  }, [])

  return (
    <View style={{ ...styles.currentList, opacity: visibleBar ? 1 : 0, borderBottomColor: REF_COLOR.divider }}>
      { fetching ? <Loading color={theme['c-button-font']} style={styles.loading} /> : null }
      <Text style={styles.currentListText} size={14} numberOfLines={1} color={REF_COLOR.text} onLongPress={onScrollToTop}>
        {currentListName}
      </Text>
      <TouchableOpacity style={styles.currentListBtns} onPress={onShowSearchBar}>
        <IconMC name="magnify" color={REF_COLOR.textSub} size={18} />
      </TouchableOpacity>
    </View>
  )
})


const styles = createStyle({
  currentList: {
    flexDirection: 'row',
    paddingLeft: 12,
    paddingRight: 2,
    height: 44,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  currentListText: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  loading: {
    marginRight: 5,
  },
  currentListBtns: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
})
