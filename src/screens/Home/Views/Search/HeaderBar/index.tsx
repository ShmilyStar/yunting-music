import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { TouchableOpacity, View } from 'react-native'

// import music from '@/utils/musicSdk'
import { BorderWidths } from '@/theme'
// import InsetShadow from 'react-native-inset-shadow'
import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import SearchInput, { type SearchInputType, type SearchInputProps } from './SearchInput'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { REF_ACCENT } from '@/config/uiPalette'
import { scaleSizeW } from '@/utils/pixelRatio'
import { type Source as MusicSource } from '@/store/search/music/state'
import { type Source as SonglistSource } from '@/store/search/songlist/state'
import { type SearchType } from '@/store/search/state'

type Sources = Readonly<Array<MusicSource | SonglistSource>>
type SourceSelectorProps = _SourceSelectorProps<Sources>
type SourceSelectorType = _SourceSelectorType<Sources>

export interface HeaderBarProps {
  onSourceChange: SourceSelectorProps['onSourceChange']
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
  /** 当前搜索类型（歌曲 / 歌单），由输入行内的类型标签切换 */
  type: SearchType
  onTypeChange: (type: SearchType) => void
}

export interface HeaderBarType {
  setSourceList: SourceSelectorType['setSourceList']
  setText: SearchInputType['setText']
  blur: SearchInputType['blur']
}

/** 类型标签：上游的 SearchTypeSelector 已删除，类型切换改为输入行内的小胶囊 */
const TypeTag = ({ type, onChange }: { type: SearchType, onChange: (type: SearchType) => void }) => {
  const t = useI18n()
  const handlePress = useCallback(() => {
    onChange(type == 'songlist' ? 'music' : 'songlist')
  }, [type, onChange])

  return (
    <TouchableOpacity style={styles.typeTag} activeOpacity={0.7} onPress={handlePress}>
      <Text size={12} color={REF_ACCENT.green.color} numberOfLines={1}>
        {t(type == 'songlist' ? 'search_type_songlist' : 'search_type_music')}
      </Text>
    </TouchableOpacity>
  )
}

export default forwardRef<HeaderBarType, HeaderBarProps>(({
  onSourceChange, onTipSearch, onSearch, onHideTipList, onShowTipList, type, onTypeChange,
}, ref) => {
  const sourceSelectorRef = useRef<SourceSelectorType>(null)
  const searchInputRef = useRef<SearchInputType>(null)
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    setSourceList(list, source) {
      sourceSelectorRef.current?.setSourceList(list, source)
    },
    setText(text) {
      searchInputRef.current?.setText(text)
    },
    blur() {
      searchInputRef.current?.blur()
    },
  }), [])


  return (
    <View style={{ ...styles.searchBar, borderBottomColor: theme['c-border-background'] }}>
      <View style={styles.selector}>
        <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} fontSize={13} />
      </View>
      <TypeTag type={type} onChange={onTypeChange} />
      <SearchInput
        ref={searchInputRef}
        onChangeText={onTipSearch}
        onSubmit={onSearch}
        onBlur={onHideTipList}
        onTouchStart={onShowTipList}
      />
    </View>
  )
})

const styles = createStyle({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    zIndex: 2,
    paddingRight: 10,
    borderBottomWidth: BorderWidths.normal,
  },
  typeTag: {
    borderRadius: scaleSizeW(6),
    backgroundColor: 'rgba(49, 194, 124, 0.08)',
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 4,
    marginRight: 8,
  },
  selector: {
    // width: 86,
  },
})
