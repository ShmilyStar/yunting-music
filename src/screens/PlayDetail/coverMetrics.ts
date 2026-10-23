/**
 * 播放页大封面的几何信息（窗口坐标）。
 *
 * 歌词设置弹窗要从顶栏下方往下拉，且底边**与封面底部齐平**——再往下会盖住
 * 封面下方的歌词预览，往上留空又会显得弹窗被截断（用户 2026-10-23 反馈）。
 *
 * 封面尺寸由 DetailPage 的 flex 布局算出，且会随歌词字号、旋转、分辨率和
 * 分屏等变化重排；只在 onLayout 时缓存一次，弹窗打开时可能拿到**过期值**
 * （实测偏差 100+px）。所以这里除了缓存，还登记一个「现量」函数：
 * SettingPopup 打开前先调用它重新 measureInWindow，拿不到再用缓存兜底。
 *
 * 坐标单位：Android 的 measureInWindow 返回物理像素，iOS 返回 pt(dp)。
 * 这里原样透传，由调用方按平台换算，保持本模块零平台判断。
 */

let coverBottom = 0
/** DetailPage 登记的重测函数；离开播放页时清空 */
let remeasure: (() => Promise<number | null>) | null = null

/** 登记封面重测函数（DetailPage 挂载时调用，返回注销函数） */
export const registerCoverMeasure = (fn: () => Promise<number | null>) => {
  remeasure = fn
  return () => {
    if (remeasure === fn) remeasure = null
  }
}

/** 缓存写入（onLayout 时调用，作为兜底值） */
export const setCoverBottom = (bottom: number) => {
  coverBottom = bottom
}

/** 缓存的封面底边（0 表示还没量到） */
export const getCoverBottom = () => coverBottom

/**
 * 取**最新**的封面底边：优先现量，失败/未登记时退回缓存。
 * 返回 0 表示当前没有可用的封面位置。
 */
export const measureCoverBottom = async(): Promise<number> => {
  if (remeasure != null) {
    const value = await remeasure()
    if (value != null && value > 0) {
      coverBottom = value
      return value
    }
  }
  return coverBottom
}
