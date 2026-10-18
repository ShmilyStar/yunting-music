import { memo, type ComponentProps } from 'react'
import { StyleSheet, type ColorValue, type StyleProp, type TextStyle } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTextShadow, useTheme } from '@/store/theme/hook'

export interface IconMCProps extends Omit<ComponentProps<typeof MaterialCommunityIcons>, 'style' | 'name' | 'size' | 'color'> {
  name: string
  /** 设计值字号，内部自动经 scaleSizeW 换算 */
  size?: number
  /** 直接给最终字号，不做缩放 */
  rawSize?: number
  color?: ColorValue
  style?: StyleProp<TextStyle>
}

/**
 * MaterialCommunityIcons 图标。
 *
 * 与 `<Text size={n}>` 同一约定：`size` 是设计值，组件内部换算；
 * 需要「屏幕上固定物理尺寸」时用 `rawSize`。
 */
export const IconMC = memo(({ name, size = 15, rawSize, color, style, ...props }: IconMCProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const newStyle: StyleProp<TextStyle> = textShadow
    ? StyleSheet.compose({
      textShadowColor: theme['c-primary-dark-300-alpha-800'],
      textShadowOffset: { width: 0.2, height: 0.2 },
      textShadowRadius: 2,
    }, style)
    : style
  return (
    <MaterialCommunityIcons
      name={name as never}
      size={rawSize ?? scaleSizeW(size)}
      color={color ?? theme['c-font']}
      // @ts-expect-error 与 Icon.tsx 同因：RN 自带类型与 react-native-vector-icons 的 @types 存在两份
      style={newStyle}
      {...props}
    />
  )
})

export default IconMC
