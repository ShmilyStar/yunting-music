// @flow

import { useEffect, useState } from 'react'
import { Navigation } from 'react-native-navigation'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  // Setting,
} from '@/screens'
import { Provider } from '@/store/Provider'
import { addWindowSizeListener } from '@/utils/pixelRatio'
import { refreshAllStyles } from '@/utils/tools'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
  TOAST_SCREEN,
  // SETTING_SCREEN,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'
import Toast from './components/Toast'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => {
      // 窗口尺寸变化（分屏、折叠屏展开、平板旋转）：重算缩放系数 + 重建所有
      // 样式表，并用一次 setState 带动本屏重渲染，让新尺寸尽快生效。
      // 订阅 `useWindowSize()` / `useIsTabletLayout()` 的子树本来就会自己重渲染。
      const [, setLayoutTick] = useState(0)
      useEffect(() => addWindowSizeListener(() => {
        refreshAllStyles()
        setLayoutTick(tick => tick + 1)
      }), [])

      return (
        <Provider>
          <Component
            {...props}
          />
        </Provider>
      )
    }

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))
  Navigation.registerComponent(TOAST_SCREEN, () => WrappedComponent(Toast))
  // Navigation.registerComponent(SETTING_SCREEN, () => WrappedComponent(Setting))

  console.info('All screens have been registered...')
}
