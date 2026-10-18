import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { REF_COLOR } from '@/config/uiPalette'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

/**
 * 设置页的分组标题：与 `Home/components/SectionHeader` 同款
 * —— 4×17 主色竖条 + 17 号标题（页面容器已提供左右内边距）。
 */
export default ({ title, children }: Props) => {
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={{ ...styles.bar, backgroundColor: theme['c-primary'] }} />
        <Text style={styles.title} size={17} color={REF_COLOR.text}>{title}</Text>
      </View>
      <View>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    // paddingLeft: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 8,
  },
  bar: {
    width: 4,
    height: 17,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
  },
})
