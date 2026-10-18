import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import Lyric from '../Lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'

/** 第 2 屏：歌名 + 歌手 + 歌词滚动区（歌词实现复用 Vertical/Lyric.tsx） */
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text size={19} numberOfLines={1} style={styles.text}>{musicInfo.name}</Text>
        <Text size={12} numberOfLines={1} color={theme['c-font-label']} style={styles.text}>
          {musicInfo.singer || t('play_detail_unknown_singer')}
        </Text>
      </View>
      <Lyric />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
})
