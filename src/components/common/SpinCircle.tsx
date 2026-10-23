import { memo, useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { scaleSizeW } from '@/utils/pixelRatio'

export interface SpinCircleProps {
  /** 设计值直径 */
  size?: number
  /** 圆环颜色（一般为图标色，随主题走） */
  color: string
  /** 设计值线宽 */
  thickness?: number
}

/**
 * 「未封闭的圆」转圈指示器。
 *
 * 用三边实色 + `borderTopColor: transparent` 画出**缺口**，再整体匀速旋转，
 * 比 ActivityIndicator 更贴近用户要的样子（用户 2026-10-22：「图标变成
 * 未封闭的圆在转圈那种」），且大小/颜色能跟图标严格对齐。
 *
 * 注意：`borderTopColor` 透明 + 旋转是纯样式动画，走 native driver 才不卡 JS 线程。
 */
export const SpinCircle = memo(({ size = 22, color, thickness = 2 }: SpinCircleProps) => {
  const spin = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => { loop.stop() }
  }, [spin])

  const d = scaleSizeW(size)
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  return (
    <Animated.View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: scaleSizeW(thickness),
        borderColor: color,
        // 缺一口，才是「未封闭的圆」
        borderTopColor: 'transparent',
        transform: [{ rotate }],
      }}
    />
  )
})

export default SpinCircle
