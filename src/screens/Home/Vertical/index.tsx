import { useCallback } from 'react'
import { View } from 'react-native'
import StatusBar from '@/components/common/StatusBar'
import Main from './Main'
import MiniPlayer, { useMiniPlayerSpace } from './MiniPlayer'
import PlayListPopup from '@/components/player/PlayListPopup'
import BottomTabBar from './BottomTabBar'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { hidePlayListPopup } from '@/core/playListPopup'
import { switchHomeTab } from '@/core/common'
import { type HOME_TAB_ID } from '@/config/homeTabs'

/**
 * 主页外壳：手机 / 平板 / 横屏共用同一套。
 *
 * 挂载顺序决定同级绘制顺序（`elevation` 不改变兄弟节点顺序）：
 * `Main < PlayListPopup < MiniPlayer < BottomTabBar`
 * —— 弹层从 mini 条上框线后面钻出来，mini 条压在弹层上。
 */
export default () => {
  const musicInfo = usePlayerMusicInfo()
  const miniSpace = useMiniPlayerSpace()

  // 播放列表弹层打开时点底部 Tab：先收起弹层再切页，
  // 否则页面切了但弹层盖在上面，看起来像「没跳转」
  const handleSelectTab = useCallback((id: HOME_TAB_ID) => {
    hidePlayListPopup()
    switchHomeTab(id)
  }, [])

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
      <BottomTabBar onSelect={handleSelectTab} />
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
