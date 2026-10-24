import { memo } from 'react'
import { View } from 'react-native'

import PlayInfo from './PlayInfo'
import ProgressRow from './ProgressRow'
import ControlBtn from './ControlBtn'
import ActionBar from '../../Vertical/components/ActionBar'
import { createStyle } from '@/utils/tools'

/**
 * 宽屏左栏播放器块：播放信息 → 操作行 → 进度行 → 控制行。
 *
 * 顺序与参考实现一致（07 §3.4）：歌名/歌手贴着封面，操作行在进度条上方，
 * 控制行在最底部；04 §播放页的竖屏块也是这个顺序。
 */
export default memo(({ panelWidth }: { panelWidth?: number }) => (
  <View style={styles.container}>
    <PlayInfo />
    <ActionBar
      iconType="icomoon"
      settingDirection="horizontal"
      settingPosition="left"
      settingPanelWidth={panelWidth}
    />
    {/* 进度条两端比控制行再收 6：左栏有 12 内边距 + 控制行 8 + 这里 6 = 26dp，
        两端落在左栏左右对称的位置上，进度条整条居中且不贴边 */}
    <View style={styles.progressRow}>
      <ProgressRow />
    </View>
    <View style={styles.controlRow}>
      <ControlBtn iconType="mc" />
    </View>
  </View>
))

const styles = createStyle({
  container: {
    flexShrink: 0,
    // 左右不再加内边距：720dp 平板左栏内容宽 300dp，
    // 控制行 5 个按钮（51×4 + 74）要 278dp，再缩 24dp 就会挤出栏外、播放键偏右
    paddingBottom: 6,
  },
  progressRow: {
    paddingLeft: 6,
    paddingRight: 6,
  },
  controlRow: {
    flexDirection: 'row',
    // 控制行左右各留 8：图标中心落在参考实现的位置
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 2,
  },
})
