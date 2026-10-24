import { memo } from 'react'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { ActivityIndicator, StyleSheet, type ActivityIndicatorProps } from 'react-native'
import { setSpText } from '@/utils/pixelRatio'
import Text from './Text'

export interface LoadingProps extends Omit<ActivityIndicatorProps, 'size'> {
  size?: number
  label?: string
}

const LoadingLabel = ({ style, label, ...props }: LoadingProps) => {
  return (
    <>
      <ActivityIndicator
        style={StyleSheet.compose(styles.loadingLabel, style)}
        {...props}
      />
      <Text color={props.color} size={props.size! * 0.8}>{label}</Text>
    </>
  )
}

export default memo(({ size = 15, label, ...props }: LoadingProps) => {
  const theme = useTheme()
  // `size` 是设计值：除带 label 的分支（内部会转成设计值再交给 `<Text size>`），
  // 其余都按 `setSpText` 换算。以前直接把 `setSpText(size)` 的结果当设计值再传，
  // 结果被 `<Text>` 又缩放了一遍，大屏上标签会明显偏大。
  const scaledSize = setSpText(size)

  return (
    label ? <LoadingLabel color={theme['c-font-label']} size={size} label={label} {...props} />
      : (
          <ActivityIndicator
            color={theme['c-font-label']}
            size={scaledSize}
            {...props}
          />
        )
  )
})


const styles = createStyle({
  loadingLabel: {
    marginRight: 6,
  },
})
