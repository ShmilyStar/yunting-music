import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import IconMC from '@/components/common/IconMC'
import { REF_ACCENT } from '@/config/uiPalette'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import { useListInfo } from './state'

/**
 * 歌单详情页的两个胶囊按钮：▶ 播放（主色实心）/ ♡ 收藏歌单（浅绿描边）。
 * 规格 03 §15。
 */
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  const handleCollection = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={{ ...styles.pill, backgroundColor: theme['c-primary'] }}
        activeOpacity={0.8}
        onPress={handlePlayAll}
      >
        <IconMC name="play" size={18} color="#FFFFFF" />
        <Text size={15} color="#FFFFFF" style={styles.pillText}>{t('play')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          ...styles.pill,
          backgroundColor: REF_ACCENT.green.bg,
          borderWidth: 1,
          borderColor: REF_ACCENT.green.color,
        }}
        activeOpacity={0.8}
        onPress={handleCollection}
      >
        <IconMC name="heart-outline" size={18} color={REF_ACCENT.green.color} />
        <Text size={15} color={REF_ACCENT.green.color} style={styles.pillText}>{t('collect_songlist')}</Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
  },
  pill: {
    height: 40,
    borderRadius: scaleSizeW(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginRight: 12,
  },
  pillText: {
    marginLeft: 6,
  },
})
