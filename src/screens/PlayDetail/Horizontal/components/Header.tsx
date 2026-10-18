import { memo } from 'react'
import { TouchableOpacity } from 'react-native'

import IconMC from '@/components/common/IconMC'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'

const BTN_SIZE = 36

/**
 * 宽屏没有顶栏，返回键悬浮在左上角。
 *
 * 点击行为由外层传入：与竖屏一致——先播面板收回动画，同时发起 pop。
 */
export default memo(({ onPress }: { onPress: () => void }) => {
  const theme = useTheme()

  return (
    <TouchableOpacity
      style={{ ...styles.btn, top: scaleSizeH(6) }}
      activeOpacity={0.5}
      onPress={onPress}
    >
      <IconMC name="chevron-down" size={24} color={theme['c-font']} />
    </TouchableOpacity>
  )
})

const styles = createStyle({
  btn: {
    position: 'absolute',
    left: 12,
    width: BTN_SIZE,
    height: BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
})
