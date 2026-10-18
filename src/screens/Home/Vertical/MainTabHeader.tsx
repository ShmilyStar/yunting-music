import { memo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { HEADER_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'

/** 主 Tab 专用标题栏：无返回键，标题居中 */
export default memo(({ title }: { title: string }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={{
      ...styles.container,
      height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
      paddingTop: statusBarHeight,
      backgroundColor: theme['c-content-background'],
      borderBottomColor: theme['c-list-header-border-bottom'],
    }}>
      <Text style={styles.title} size={17} numberOfLines={1}>{title}</Text>
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
})
