import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import IconMC from '@/components/common/IconMC'
import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'

const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

/** 评论页头部：与二级页标题栏同款（左返回 + 居中标题），规格 03 §15 */
export default memo(({ musicInfo }: {
  musicInfo: LX.Music.MusicInfo
}) => {
  const t = useI18n()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    void pop(commonState.componentIds.comment!)
  }

  return (
    <View style={{
      ...styles.wrap,
      height: HEADER_HEIGHT + statusBarHeight,
      paddingTop: statusBarHeight,
      backgroundColor: theme['c-content-background'],
      borderBottomColor: theme['c-list-header-border-bottom'],
    }}>
      <StatusBar />
      <View style={styles.container}>
        <TouchableOpacity onPress={back} style={{ ...styles.button, width: HEADER_HEIGHT }}>
          <IconMC name="chevron-left" size={24} color={theme['c-font']} />
        </TouchableOpacity>
        <Text numberOfLines={1} size={17} style={styles.title}>{t('comment_title', { name: musicInfo.name, singer: musicInfo.singer })}</Text>
        <View style={styles.right} />
      </View>
    </View>
  )
})


const styles = createStyle({
  wrap: {
    width: '100%',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
  },
  button: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    textAlign: 'center',
  },
  right: {
    width: HEADER_HEIGHT,
    flexGrow: 0,
    flexShrink: 0,
  },
})
