import { Platform, StatusBar, type View } from 'react-native'
import commonState from '@/store/common/state'

/**
 * `measureInWindow` 的坐标系差异（RN 0.73 源码 + 真机实测确认）：
 *
 * - **单位是 dp/pt，不是物理像素**。Android 侧返回前已过
 *   `PixelUtil.toDIPFromPixel`（见 `UIViewOperationQueue.MeasureInWindowOperation`），
 *   所以**绝对不要**再拿 `PixelRatio.get()` 去除一次，否则数值会被缩小 3 倍。
 * - Android 的 y 还**减掉了可见窗口上沿**（`NativeViewHierarchyManager#measureInWindow`
 *   用 `getWindowVisibleDisplayFrame().top` 做偏移），即状态栏高度被扣掉了；
 *   iOS 返回的是窗口坐标 pt（含状态栏）。
 *
 * 所以「Android 量到的 y」要加回状态栏高度，才是屏幕上真实的绝对位置。
 * 实测：封面量到 282.67（dp），屏幕真实底边 306.67dp，差值正好是 24dp 状态栏。
 */
export const measureWindowOriginTop = () => Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? commonState.statusbarHeight ?? 0)
  : 0

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 量一个节点在窗口里的矩形（dp/pt，已换算成「屏幕绝对坐标，含状态栏」）。
 * 量不到（节点已卸载 / 尺寸为 0）时返回 null。
 */
export const measureInWindowRect = async(node: View | null): Promise<WindowRect | null> => {
  if (node == null) return null
  return new Promise<WindowRect | null>(resolve => {
    node.measureInWindow((x, y, width, height) => {
      if (!(width > 0) || !(height > 0)) {
        resolve(null)
        return
      }
      resolve({ x, y: y + measureWindowOriginTop(), width, height })
    })
  })
}

/** 量节点底边在屏幕上的绝对位置（dp/pt，含状态栏）。量不到返回 null。 */
export const measureNodeBottom = async(node: View | null): Promise<number | null> => {
  const rect = await measureInWindowRect(node)
  return rect == null ? null : rect.y + rect.height
}
