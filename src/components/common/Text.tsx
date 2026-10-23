import { memo, useMemo, type ComponentProps } from 'react'
import { Text, type TextProps as _TextProps, StyleSheet, Animated, type ColorValue, type TextStyle } from 'react-native'
import { useTextShadow, useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'
import { useAnimateColor } from '@/utils/hooks/useAnimateColor'
import { DEFAULT_DURATION, useAnimateNumber } from '@/utils/hooks/useAnimateNumber'
// import { AppColors } from '@/theme'

export interface TextProps extends _TextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}

export default memo(({ style, size = 15, color, children, ...props }: TextProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()

  /**
   * 样式对象必须缓存。
   *
   * `Text` 是全 App 最底层的叶子组件（一屏列表就有上百个）。以前每次渲染都
   * 字面量新建基础样式再 `StyleSheet.compose`，compose 在第二参是普通对象时
   * 每次返回**新引用** → 原生端每帧都要重新 flatten 样式，滚动时明显掉帧。
   * 这里按真实依赖缓存，引用稳定后原生侧可以直接跳过样式重建。
   */
  const computedStyle = useMemo(() => StyleSheet.compose(
    textShadow
      ? {
          textShadowColor: theme['c-primary-dark-300-alpha-800'],
          textShadowOffset: { width: 0.2, height: 0.2 },
          textShadowRadius: 2,
          fontSize: setSpText(size),
          color: color ?? theme['c-font'],
        }
      : {
          fontSize: setSpText(size),
          color: color ?? theme['c-font'],
        },
    style,
  ), [textShadow, theme, size, color, style])

  return (
    <Text
      style={computedStyle}
      // 系统字号倍率已经由 `setSpText` 里的 `/ fontScale` 算进字号了，
      // 再让 RN 乘一次会放大两遍；App 内的「字体大小」设置才是唯一入口。
      allowFontScaling={false}
      {...props}
    >{children}</Text>
  )
})

export interface AnimatedTextProps extends _AnimatedTextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}
export const AnimatedText = ({ style, size = 15, color, children, ...props }: AnimatedTextProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  style = StyleSheet.compose(textShadow ? {
    // fontFamily: 'System',
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: setSpText(size),
    color: color ?? theme['c-font'],
  } : {
    // fontFamily: 'System',
    fontSize: setSpText(size),
    color: color ?? theme['c-font'],
  }, style as TextStyle)

  return <Animated.Text style={style} allowFontScaling={false} {...props}>{children}</Animated.Text>
}


type _AnimatedTextProps = ComponentProps<(typeof Animated)['Text']>
export interface AnimatedColorTextProps extends _AnimatedTextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: string
  /**
   * 字体透明度
   */
  opacity?: number
}
export const AnimatedColorText = ({ style, size = 15, opacity: _opacity, color: _color, children, ...props }: AnimatedColorTextProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()

  const [color] = useAnimateColor(_color ?? theme['c-font'])
  const [opacity] = useAnimateNumber(_opacity ?? 1, DEFAULT_DURATION, false)

  style = StyleSheet.compose(textShadow ? {
    // fontFamily: 'System',
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: setSpText(size),
    color: color as unknown as ColorValue,
    opacity,
  } : {
    // fontFamily: 'System',
    fontSize: setSpText(size),
    color: color as unknown as ColorValue,
    opacity,
  }, style as TextStyle)

  return <Animated.Text style={style} allowFontScaling={false} {...props}>{children}</Animated.Text>
}
