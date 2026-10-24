import { memo } from 'react'
import { View } from 'react-native'

import ControlBtn from '../../Horizontal/Player/ControlBtn'
import ProgressRow from '../../Horizontal/Player/ProgressRow'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

/** 进度条 + 时间 + 控制行。挂在 PagerView 之外，不随双屏滑动 */
export default memo(() => (
  <View style={styles.container} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
    <ProgressRow />
    {/* 控制行再加 2：与操作行的 14 对齐（截图里两侧图标竖向对齐） */}
    <View style={styles.controlRow}>
      <ControlBtn iconType="mc" />
    </View>
  </View>
))

const styles = createStyle({
  container: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  controlRow: {
    flexDirection: 'row',
    paddingLeft: 2,
    paddingRight: 2,
  },
})
