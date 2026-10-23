import { memo } from 'react'
import { View } from 'react-native'

import ProgressBar from '@/components/player/ProgressBar'
import Text from '@/components/common/Text'
import { useProgress } from '@/store/player/hook'
import { useBufferProgress } from '@/plugins/player'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/** 进度条 + 时间行（竖屏 PlayBar 与宽屏播放器共用） */
export default memo(() => {
  const theme = useTheme()
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()

  return (
    <View>
      <ProgressBar progress={progress} duration={maxPlayTime} buffered={buffered} />
      <View style={styles.timeRow}>
        <Text size={11} color={theme['c-font-label']}>{nowPlayTimeStr}</Text>
        <Text size={11} color={theme['c-font-label']}>{maxPlayTimeStr}</Text>
      </View>
    </View>
  )
})

const styles = createStyle({
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 4,
  },
})
