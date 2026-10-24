import { forwardRef, useImperativeHandle } from 'react'

/** iOS 没有桌面歌词悬浮窗，开关组件为空实现。 */
export interface DesktopLyricEnableType {
  setEnabled: (enabled: boolean) => void
}

export default forwardRef<DesktopLyricEnableType, {}>((_props, ref) => {
  useImperativeHandle(ref, () => ({ setEnabled: () => {} }), [])
  return null
})
