import { memo, useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { HEADER_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { setTopBarInset, MAIN_KEY } from '@/utils/topBarInset'

/**
 * 主 Tab 专用标题栏：无返回键，标题居中。
 *
 * `right` 是右侧动作槽（搜索 / 设置），只在主 Tab 页传入；
 * 绝对定位在标题栏右侧，不参与标题居中。
 */
export default memo(({ title, right }: { title: string, right?: ReactNode }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  /**
   * 标题栏高度：状态栏 + 设计值（与本组件自己的 style 完全同一份来源，
   * 所以**永远不会**算出偏差）。
   *
   * 不再用 measureInWindow：RN 在 Android 上不仅返回 dp（不是像素），
   * 还减掉了状态栏（见 `utils/windowMeasure.ts` 的说明）。实测上报 40dp，
   * 而真实下框线是 64dp —— 播放列表弹层因此整体上移 24dp，压进标题栏里
   * （用户 2026-10-23 反馈「弹窗把顶栏遮挡了」）。
   */
  const inset = statusBarHeight + scaleSizeH(HEADER_HEIGHT)

  // 上报下框线：播放列表弹层的上沿要正好贴在这条线上（见 utils/topBarInset.ts）。
  // 用 effect 而不是 onLayout：值完全由上面两个量算出，不需要等布局回调。
  useEffect(() => { setTopBarInset(MAIN_KEY, inset) }, [inset])

  return (
    <View
      style={{
        ...styles.container,
        height: inset,
        paddingTop: statusBarHeight,
        backgroundColor: theme['c-content-background'],
        borderBottomColor: theme['c-list-header-border-bottom'],
      }}
    >
      <Text style={styles.title} size={17} numberOfLines={1}>{title}</Text>
      {right
        ? <View style={{ ...styles.right, top: statusBarHeight }}>{right}</View>
        : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  title: { textAlign: 'center' },
  right: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingRight: 10,
  },
})
