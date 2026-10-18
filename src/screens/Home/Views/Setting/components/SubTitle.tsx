import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { REF_COLOR } from '@/config/uiPalette'

/**
 * 分组内的次级标题（主题颜色 / 语言 / 字体大小 / 分享方式 / 自定义源…）：
 * 与分组标题同级同字号，但没有竖条。
 */
export default memo(({ title, children }: {
  title: string
  children: React.ReactNode | React.ReactNode[]
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title} size={17} color={REF_COLOR.text}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingLeft: 25,
    marginBottom: 18,
  },
  title: {
    marginLeft: -10,
    marginBottom: 10,
    paddingTop: 16,
  },
})
