import { memo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Input from '@/components/common/Input'
import IconMC from '@/components/common/IconMC'
import { REF_COLOR } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

export interface ModuleSearchBarProps {
  /** 占位文案（已翻译） */
  placeholder: string
  value: string
  onChangeText: (text: string) => void
  /** 外层间距覆盖：嵌在「我的」页分段里时用来压掉多余留白 */
  style?: StyleProp<ViewStyle>
}

/**
 * 模块内搜索框：只过滤当前模块已加载的内容，不触发全局搜索。
 * 歌单 / 排行榜 / 歌曲 / 歌手 / 专辑 / 最近播放共用。
 */
export const ModuleSearchBar = memo(({ placeholder, value, onChangeText, style }: ModuleSearchBarProps) => {
  const theme = useTheme()

  return (
    <View style={[styles.wrap, style]}>
      <View style={{
        ...styles.box,
        backgroundColor: theme['c-primary-input-background'],
        borderColor: theme['c-border-background'],
      }}>
        <IconMC name="magnify" size={17} color={theme['c-font-label']} />
        <Input
          style={styles.input}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={REF_COLOR.textHint}
          onChangeText={onChangeText}
          clearBtn={!!value}
          size={13}
          returnKeyType="search"
        />
      </View>
    </View>
  )
})

const styles = createStyle({
  wrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  box: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 6,
    paddingRight: 0,
    height: 32,
  },
})

export default ModuleSearchBar
