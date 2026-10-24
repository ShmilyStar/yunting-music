import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { type InitState } from '@/store/hotSearch/state'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import IconMC from '@/components/common/IconMC'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { scaleSizeW } from '@/utils/pixelRatio'


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch, onRemove }: {
  keyword: string
  onSearch: (keyword: string) => void
  onRemove: (keyword: string) => void
}) => {
  return (
    <TouchableOpacity
      style={styles.tag}
      activeOpacity={0.7}
      onPress={() => { onSearch(keyword) }}
      onLongPress={() => { onRemove(keyword) }}
    >
      <Text color={REF_ACCENT.green.color} size={12} numberOfLines={1}>{keyword}</Text>
    </TouchableOpacity>
  )
}


interface HistorySearchProps {
  onSearch: (keyword: string) => void
}
export interface HistorySearchType {
  show: () => void
}

export default forwardRef<HistorySearchType, HistorySearchProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const isUnmountedRef = useRef(false)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      void getSearchHistory().then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  const handleClear = () => {
    clearHistoryList()
    setList([])
  }

  const handleRemove = useCallback((keyword: string) => {
    setList(list => {
      list = [...list]
      const index = list.indexOf(keyword)
      list.splice(index, 1)
      removeHistoryWord(index)
      return list
    })
  }, [])

  return (
    list.length
      ? (
          <View>
            <View style={styles.titleContent}>
              <Text size={17} color={REF_COLOR.text}>{t('search_history_search')}</Text>
              <TouchableOpacity onPress={handleClear} style={styles.titleBtn}>
                <IconMC name="eraser" color={theme['c-300']} size={16} />
              </TouchableOpacity>
            </View>
            <View style={styles.list}>
              {
                list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} onRemove={handleRemove} />)
              }
            </View>
          </View>
        )
      : null
  )
})


const styles = createStyle({
  titleContent: {
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBtn: {
    marginLeft: 10,
    padding: 5,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
  },
  tag: {
    height: 26,
    paddingLeft: 11,
    paddingRight: 11,
    justifyContent: 'center',
    borderRadius: scaleSizeW(6),
    backgroundColor: 'rgba(49, 194, 124, 0.08)',
    marginRight: 8,
    marginBottom: 8,
  },
})
