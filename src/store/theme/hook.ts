import { useContext, useEffect, useState } from 'react'
import { ThemeContext } from './state'
import settingState from '@/store/setting/state'

// export const useSetting = () => {
//   const [setting, updateSetting] = useState(state.setting)

//   useEffect(() => {
//     const handleUpdate = () => {
//       updateSetting(state.setting)
//     }
//     global.state_event.on('configUpdated', handleUpdate)
//     return () => {
//       global.state_event.off('configUpdated', handleUpdate)
//     }
//   }, [])

//   return setting
// }

// export const useSettingValue = <T extends keyof LX.AppSetting>(key: T): LX.AppSetting[T] => {
//   const [value, update] = useState(state.setting[key])

//   useEffect(() => {
//     const handleUpdate = (keys: Array<keyof LX.AppSetting>) => {
//       if (!keys.includes(key)) return
//       update(state.setting[key])
//     }
//     global.state_event.on('configUpdated', handleUpdate)
//     return () => {
//       global.state_event.off('configUpdated', handleUpdate)
//     }
//   }, [key])

//   return value
// }

export const useTheme = () => useContext(ThemeContext)

/**
 * 是否启用字体阴影。
 *
 * 这是 `Text` / `Icon` / `IconMC` 三个**基础叶子组件**都会调的 hook，
 * 全 App 的订阅者数量以千计。以前这里有两个问题：
 * 1. 无条件 `update(setting[...])`：任何设置项写盘都会让所有订阅者跑一次 render
 *    （即使 `theme.fontShadow` 根本没变）；
 * 2. `requestAnimationFrame` 里再 setState，把重渲染推迟到下一帧，
 *    在滚动/播放时叠加成可见掉帧。
 *
 * 现在：值不变直接 bail out，并且只在真的变化时才调度下一帧。
 */
export const useTextShadow = () => {
  const [value, update] = useState(settingState.setting['theme.fontShadow'])

  useEffect(() => {
    const handleUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
      if (!keys.includes('theme.fontShadow')) return
      const next = setting['theme.fontShadow']!
      // 同值提前返回，避免无意义的重渲染
      update(prev => (prev === next ? prev : next))
    }
    global.state_event.on('configUpdated', handleUpdate)
    return () => {
      global.state_event.off('configUpdated', handleUpdate)
    }
  }, [])

  return value
}
