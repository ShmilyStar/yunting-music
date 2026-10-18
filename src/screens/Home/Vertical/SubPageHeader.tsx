import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { HEADER_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { goBackNav } from '@/core/common'

/** 二级页标题栏：左返回键 + 居中标题 + 可选右插槽 */
export default memo(({ title, right }: { title: string, right?: ReactNode }) => {
  const theme = useTheme()

  return (
    // 主 Tab 标题栏始终在最上面（含状态栏高度），二级页这一行只占自己的高度；
    // 再加状态栏高度会与上方标题栏之间多出一段空白
    <View style={{
      ...styles.container,
      height: scaleSizeH(HEADER_HEIGHT),
      backgroundColor: theme['c-content-background'],
      borderBottomColor: theme['c-list-header-border-bottom'],
    }}>
      <TouchableOpacity style={styles.btn} activeOpacity={0.6} onPress={goBackNav}>
        <IconMC name="chevron-left" size={24} color={theme['c-font']} />
      </TouchableOpacity>
      <Text style={styles.title} size={17} numberOfLines={1}>{title}</Text>
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
  btn: { width: HEADER_HEIGHT, height: '100%', alignItems: 'center', justifyContent: 'center' },
  title: { flexGrow: 1, flexShrink: 1, paddingLeft: 2 },
  right: { flexGrow: 0, flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
})
