import { memo, type ReactNode } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import HeaderBackBtn from '@/components/common/HeaderBackBtn'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { goBackNav } from '@/core/common'

/**
 * 二级页标题栏的几何（设计值）。
 *
 * 高度按「图标 + 字号」贴身给（28 图标放 46 的框里上下各留 9）；返回项直接用
 * `HeaderBackBtn`，与歌单详情页左上角是同一个组件、同一份尺寸。
 */
export const SUB_HEADER_HEIGHT = 46
export const SUB_HEADER_ICON = 28
export const SUB_HEADER_FONT = 19

/** 二级页标题栏：左返回键 + 居中标题 + 可选右插槽 */
export default memo(({ title, right, onBack }: {
  title: string
  right?: ReactNode
  /** 默认是主界面内的导航出栈；推入的独立屏幕（如歌单详情）传自己的 pop */
  onBack?: () => void
}) => {
  const theme = useTheme()

  return (
    // 主 Tab 标题栏始终在最上面（含状态栏高度），二级页这一行只占自己的高度；
    // 再加状态栏高度会与上方标题栏之间多出一段空白
    <View style={{
      ...styles.container,
      height: scaleSizeH(SUB_HEADER_HEIGHT),
      backgroundColor: theme['c-content-background'],
      borderBottomColor: theme['c-list-header-border-bottom'],
    }}>
      <HeaderBackBtn onPress={onBack ?? goBackNav} style={styles.btn} />
      <Text style={styles.title} size={SUB_HEADER_FONT} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  )
})

const styles = createStyle({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  btn: { height: '100%' },
  title: { flexGrow: 1, flexShrink: 1, paddingLeft: 2 },
  right: { flexGrow: 0, flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
})
