import { View } from 'react-native'
import StatusBar from '@/components/common/StatusBar'
import Main from './Main'
import MiniPlayer, { useMiniPlayerSpace } from './MiniPlayer'
import PlayListPopup from '@/components/player/PlayListPopup'
import BottomTabBar from './BottomTabBar'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo } from '@/store/player/hook'

/**
 * 主页外壳：手机 / 平板 / 横屏共用同一套。
 *
 * 挂载顺序决定同级绘制顺序（`elevation` 不改变兄弟节点顺序）：
 * `Main < MiniPlayer < PlayListPopup < BottomTabBar`
 * —— 效果是弹层从底部 Tab 栏的上框线后面钻出来。
 */
export default () => {
  const musicInfo = usePlayerMusicInfo()
  const miniSpace = useMiniPlayerSpace()

  return (
    <View style={styles.container}>
      <StatusBar />
      {/* 有歌时给页面留出 mini 条的高度，否则最后一行会被 mini 条压住 */}
      <View style={{ ...styles.mainWrap, paddingBottom: musicInfo.id ? miniSpace : 0 }}>
        <Main />
      </View>
      {/* 弹层在 mini 条之前挂载：弹层从 mini 条上框线后面钻出来，mini 条压在它上面 */}
      <PlayListPopup variant="home" />
      <MiniPlayer />
      <BottomTabBar />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  mainWrap: {
    flex: 1,
  },
})
