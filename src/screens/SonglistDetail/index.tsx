import { useCallback, useEffect, useMemo, useRef } from 'react'

import MusicList, { type MusicListType } from './MusicList'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import MainTabHeader from '@/screens/Home/Vertical/MainTabHeader'
import MiniPlayer, { useMiniPlayerSpace } from '@/screens/Home/Vertical/MiniPlayer'
import PlayListPopup from '@/components/player/PlayListPopup'
import BottomTabBar from '@/screens/Home/Vertical/BottomTabBar'
import { setComponentId, switchHomeTab } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { HOME_TABS, type HOME_TAB_ID } from '@/config/homeTabs'
import { pop } from '@/navigation'
import { type ListInfoItem } from '@/store/songlist/state'
import { ListInfoContext } from './state'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useNavStack } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { View } from 'react-native'


export default ({ componentId, info }: { componentId: string, info: ListInfoItem }) => {
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  const musicInfo = usePlayerMusicInfo()
  const miniSpace = useMiniPlayerSpace()
  const t = useI18n()
  const navStack = useNavStack()

  /** 顶部主 Tab 标题栏：歌单详情页也在它下面，与其他页面保持同一套顶栏 */
  const title = useMemo(() => {
    const tab = HOME_TABS.find(item => item.id == navStack[0]) ?? HOME_TABS[0]
    return t(tab.labelKey)
  }, [navStack, t])

  useEffect(() => {
    setComponentId(COMPONENT_IDS.songlistDetail, componentId)

    isUnmountedRef.current = false

    musicListRef.current?.loadList(info.source, info.id)


    return () => {
      isUnmountedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 底部三 Tab 在本屏也常驻：点 Tab = 退出本屏再切主界面
  const handleSelectTab = useCallback((id: HOME_TAB_ID) => {
    void pop(componentId).then(() => { switchHomeTab(id) })
  }, [componentId])

  return (
    <PageContent>
      <StatusBar />
      <MainTabHeader title={title} />
      {/* 有歌时给列表留出 mini 条的高度，避免最后一行被压住 */}
      <View style={{ ...styles.content, paddingBottom: musicInfo.id ? miniSpace : 0 }}>
        <ListInfoContext.Provider value={info}>
          <MusicList ref={musicListRef} componentId={componentId} />
        </ListInfoContext.Provider>
      </View>
      {/* 挂载顺序：弹层 < mini 条 < 底栏（弹层从 mini 条上框线后钻出来） */}
      <PlayListPopup variant="home" />
      <MiniPlayer />
      <BottomTabBar onSelect={handleSelectTab} />
    </PageContent>
  )
}

const styles = createStyle({
  content: {
    flex: 1,
  },
})
