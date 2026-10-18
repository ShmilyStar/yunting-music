import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { type Source, type InitState } from '@/store/hotSearch/state'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { REF_ACCENT, REF_COLOR } from '@/config/uiPalette'
import { scaleSizeW } from '@/utils/pixelRatio'


interface ListProps {
  onSearch: (keyword: string) => void
}
export interface HotSearchType {
  show: (source: Source) => void
}


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

/** 热门搜索标签：小圆角、浅绿底、多行折行 */
const ListItem = ({ keyword, onSearch }: {
  keyword: string
  onSearch: (keyword: string) => void
}) => {
  return (
    <TouchableOpacity
      style={styles.tag}
      activeOpacity={0.7}
      onPress={() => { onSearch(keyword) }}
    >
      <Text color={REF_ACCENT.green.color} size={12} numberOfLines={1}>{keyword}</Text>
    </TouchableOpacity>
  )
}

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  // const listRef = useRef<MusicListType>(null)
  const [list, setList] = useState<List>([])
  const t = useI18n()
  // const theme = useTheme()

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      void getList(source).then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  return (
    list.length
      ? (
          <View>
            <Text style={styles.title} size={17} color={REF_COLOR.text}>{t('search_hot_search')}</Text>
            <View style={styles.list}>
              {
                list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} />)
              }
            </View>
          </View>
        )
      : null
  )
})


const styles = createStyle({
  title: {
    paddingTop: 16,
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
