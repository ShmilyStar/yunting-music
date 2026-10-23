import { useEffect, useRef } from 'react'
import { type EmitterSubscription } from 'react-native'
import { Navigation } from 'react-native-navigation'

/**
 * RNN 事件 hook 的统一写法：**回调放进 ref**，effect 依赖只保留 `componentId`。
 *
 * 原来依赖 `[callback]`，而调用方普遍传内联箭头（如 `SonglistDetail/Header.tsx`），
 * 每次渲染回调标识都变 → 每次都重新 `registerComponentListener`，
 * command-completed 更是全局监听（任何导航命令都会触发回调）。
 */
const useStableCallback = <T extends (...args: never[]) => void>(callback: T) => {
  const ref = useRef(callback)
  ref.current = callback
  return useRef((...args: never[]) => { ref.current(...args) }).current
}

export const useNavigationComponentDidAppear = (componentId: string, callback: () => void) => {
  const stableCallback = useStableCallback(callback)
  useEffect(() => {
    const unsubscribe = Navigation.events().registerComponentListener({
      componentDidAppear: () => { stableCallback() },
    }, componentId)
    return () => {
      unsubscribe.remove()
    }
  }, [componentId, stableCallback])
}

export const onNavigationComponentDidDisappearEvent = (componentId: string, callback = () => {}) => {
  const listener = {
    componentDidDisappear: () => {
      callback()
    },
  }
  return Navigation.events().registerComponentListener(listener, componentId)
}

export const useNavigationComponentDidDisappear = (componentId: string, callback: () => void) => {
  const stableCallback = useStableCallback(callback)
  useEffect(() => {
    const unsubscribe = Navigation.events().registerComponentListener({
      componentDidDisappear: () => { stableCallback() },
    }, componentId)
    return () => {
      unsubscribe.remove()
    }
  }, [componentId, stableCallback])
}

// 保留导出签名以免调用方类型报错（当前无调用者，但属公共 API）
export type { EmitterSubscription }
