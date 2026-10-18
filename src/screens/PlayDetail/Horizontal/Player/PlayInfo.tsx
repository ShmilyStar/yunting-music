import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import Status from './Status'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'

/** 宽屏播放信息：歌名（17）+ 歌手（12）+ 播放状态，与大封面中线对齐（07 §3.4） */
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()

  return (
    <View style={styles.container}>
      <Text size={17} numberOfLines={1} style={styles.name}>{musicInfo.name}</Text>
      <Text size={12} numberOfLines={1} color={theme['c-font-label']} style={styles.singer}>
        {musicInfo.singer || t('play_detail_unknown_singer')}
      </Text>
      <View style={styles.status}>
        <Status />
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  name: {
    maxWidth: '100%',
    textAlign: 'center',
  },
  singer: {
    maxWidth: '100%',
    marginTop: 2,
    textAlign: 'center',
  },
  status: {
    marginTop: 2,
  },
})
