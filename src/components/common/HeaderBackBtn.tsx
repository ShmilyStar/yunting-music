import { memo } from 'react'
import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import IconMC from '@/components/common/IconMC'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

/**
 * 返回项的统一几何（设计值）。
 *
 * 二级页标题栏与歌单详情页左上角用的是**同一个组件**，尺寸/图标/位置都从
 * 这里出，避免两边各写一份数值后看起来不一致（用户反馈过两次）。
 */
export const HEADER_BACK_SIZE = 46
export const HEADER_BACK_ICON = 28

export interface HeaderBackBtnProps {
  onPress: () => void
  /** 追加样式：二级页标题栏里是普通子项，详情页里是绝对定位悬浮 */
  style?: StyleProp<ViewStyle>
  color?: string
}

/**
 * 返回项：46×46 热区 + 28 的返回箭头，居中。
 *
 * 详情页那边外层要再给 `elevation`，Android 上它才会压过带 elevation 的封面。
 */
export default memo(({ onPress, style, color }: HeaderBackBtnProps) => {
  const theme = useTheme()

  return (
    <TouchableOpacity
      style={[{
        width: scaleSizeW(HEADER_BACK_SIZE),
        height: scaleSizeH(HEADER_BACK_SIZE),
        alignItems: 'center',
        justifyContent: 'center',
      }, style]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <IconMC name="chevron-left" size={HEADER_BACK_ICON} color={color ?? theme['c-font']} />
    </TouchableOpacity>
  )
})
