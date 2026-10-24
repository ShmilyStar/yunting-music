/**
 * Created by qianxin on 17/6/1.
 * 屏幕工具类
 * ui设计基准,iphone 6
 * width:375
 * height:667
 */
import { Dimensions, PixelRatio, Platform } from 'react-native'
import { windowSizeTools } from './windowSizeTools'
import { isTabletLayout } from './layoutBreakpoints'

// 高保真的宽度和高度
const designWidth = 375.0
const designHeight = 667.0

let screenW = 0
let screenH = 0
/** 未归一化的窗口 dp（保留朝向）：平板判据要知道「宽 > 高」 */
let winW = 0
let winH = 0
let fontScale = PixelRatio.getFontScale()
let pixelRatio = PixelRatio.get()
let scale = 1
let isLandscape = false

/**
 * 是否平板布局。
 *
 * 规则集中在 `utils/layoutBreakpoints.ts`：横屏宽 ≥ 700dp 且比例 < 2.0；
 * 竖屏最短边 ≥ 600dp 且比例 < 1.7（竖屏 16:9 的大屏手机走手机档）。
 * 这里传入的是「窗口 dp」，函数内部自己取最短 / 最长边，与朝向无关。
 */
export const getIsTabletLayout = () => {
  if (winW <= 0 || winH <= 0) return false
  return isTabletLayout(winW, winH)
}

/**
 * 平板档的缩放口径：控件按 1:1 的 dp 摆放，与手机同尺寸。
 *
 * 平板的空间差异由**列数、分栏和左右留白**处理，不再把整张手机界面等比放大。
 * 等比放大会让 600dp 竖屏平板上的标题、胶囊、歌曲行全部胀大，一屏反而看不到几行。
 */
const getTabletScale = () => 1

/**
 * 用户「字体大小」设置的倍率。
 *
 * 0.8 / 0.9 / 1 / 1.1 / 1.2 / 1.3 全部按用户所选**原样生效**：
 * 以前这里夹了「下限 1」，导致选了「标准」也回不到原来的大小，反而更困惑。
 *
 * 需要提醒的是：如果把这里理解成「高分辨率手机上一切都小」的开关，那是误判——
 * 真正让界面变小的是这一项被设成 0.8/0.9 后**乘以整个界面**（字号 + 控件 + 图标）。
 * 现在改成**重启后生效**（见 `core/common.ts` 的 `setFontSize`）：
 * 用户改完重启，看到的就是自己选的比例，不会再出现「改了没反应」的错觉。
 */
const appliedFontSize = () => global.lx.fontSize || 1

/**
 * 手机档的最大放大倍率（dp 口径）。
 *
 * 设计基准是 375×667。以前夹在 1.3：617dp 宽的 4K 手机（2160×3840@560）
 * 只用上 1.3 倍，等于把 375dp 的界面塞进 487dp，四周全是空白，用户反馈
 * 「元素看起来太小」。现在放宽到 2，让界面跟着屏宽走，同时仍留上限，
 * 避免极端窄屏手机上字号撑破。
 */
const MAX_DP_SCALE = 2
/**
 * 高度相对宽度的额外余量。
 *
 * 纯按高度算（`screenH / 667`）会让 20:9 长条屏把字号撑得比宽度还大；
 * 这里给高度一个 1.15 的宽松系数，再取两者的较小值——宽度通常先撞上限。
 */
const HEIGHT_SCALE_SLACK = 1.15

/**
 * 手机档的 dp 放大倍率（字号与控件共用同一份，保证比例一致）。
 *
 * 平板与横屏手机固定 1:1 dp，由布局（列数 / 分栏 / 留白）适配，不走这里。
 *
 * **iOS 额外放大**：设计基准 375pt 是按 iPhone 6 定的，而现在的 iPhone
 * （16 Pro 是 402×874pt）宽度只比基准大 7%，算出来的倍率约 1.07 ——
 * 用户反馈「主屏字体太小」。iOS 与 Android 的区别在于：Android 有大屏
 * 字体放大的系统级预期，iOS 则是「同样字号看起来更小」。
 * 这里给 iOS 一个 1.18 的补偿系数，让 402pt 的机器落在 ~1.27 倍
 * （13 号字 → 16.5pt，接近 iOS 系统正文字号），
 * 视觉尺寸接近 Android 同宽机型的观感。
 */
const IOS_DP_SCALE_BOOST = Platform.OS === 'ios' ? 1.18 : 1

const computeDpScale = () => Math.min(
  (screenW / designWidth) * IOS_DP_SCALE_BOOST,
  (screenH / designHeight) * HEIGHT_SCALE_SLACK,
  MAX_DP_SCALE,
)

/**
 * 按当前窗口尺寸重算缩放系数。
 *
 * 原来是模块加载时算一次就固定，分屏 / 折叠屏展开 / 平板旋转后不会更新
 * （列的增减靠 `key` 重挂载兜着，样式数值却停在旧档位）。现在把这段抽成
 * 可重复调用的函数，由 `refreshAllStyles()` 在窗口变化时统一触发。
 *
 * **按 dp 而不是 px 定倍率**：以前用 `screenPx / 375` 再夹到 3.1，夹的是
 * 像素倍率，同一块屏换了 DPI（2160×3840@640 与 @480 同为 dp 尺寸）得到的
 * dp 倍率不同，高分辨率机器上整套控件会被压小一圈（用户 2026-10-21 反馈）。
 * 现在先算 dp 倍率再乘 `pixelRatio`，dp 尺寸相同 → 布局相同，与 DPI 无关。
 */
const computeGeometry = () => {
  const size = windowSizeTools.getSize()
  isLandscape = size.width > size.height
  winW = size.width
  winH = size.height
  screenW = size.width
  screenH = size.height
  if (screenW > screenH) {
    const temp = screenW
    screenW = screenH
    screenH = temp
  }
  fontScale = PixelRatio.getFontScale()
  pixelRatio = PixelRatio.get()
  if (getIsTabletLayout() || isLandscape) {
    // 平板横竖屏与手机横屏统一 1:1 dp：scale 是「px / 设计 dp」，
    // 除以 pixelRatio 后正好等于设计值。横屏手机不再被 667 的高度基准压小。
    scale = getTabletScale() * pixelRatio
    return
  }
  // 手机竖屏：dp 倍率 × pixelRatio 换算回 px
  scale = computeDpScale() * pixelRatio
}

computeGeometry()

/** 重算缩放系数（不重建样式表；一般用 `refreshAllStyles()`） */
export const refreshScale = () => {
  computeGeometry()
}

/** 监听窗口尺寸变化，返回取消函数（listener 内部只在尺寸真的变了时回调） */
export const addWindowSizeListener = (listener: () => void) => {
  const sub = Dimensions.addEventListener('change', ({ window }) => {
    const nextW = Math.min(window.width, window.height)
    const nextH = Math.max(window.width, window.height)
    if (nextW == screenW && nextH == screenH) return
    listener()
  })
  return () => { sub.remove() }
}

/**
 * 设置text
 *
 * 与控件（`scaleSizeW/H`）共用 `computeDpScale()` 的倍率：字号和控件的
 * 放大口径不一致时，大屏手机上会出现「字放大了、行高没放大」的挤字。
 *
 * @param size  px
 * @returns dp
 */
export function getTextSize(size: number) {
  let textScale = 1
  // 平板与横屏手机：字号与设计值同档（1:1 dp），靠布局而不是缩小来适配
  if (!getIsTabletLayout() && !isLandscape) textScale = computeDpScale()
  return Math.floor(size * textScale / fontScale)
}
export function setSpText(size: number) {
  return getTextSize(size) * appliedFontSize()
}

/**
 * 设置高度
 * @param size  px
 * @returns dp
 */
export function scaleSizeH(size: number) {
  // console.log(screenPxH / designHeight)
  // let scaleHeight = size * Math.min(screenPxH / designHeight, 3.1)
  let scaleHeight = size * scale
  size = Math.floor(scaleHeight / pixelRatio)
  return size * appliedFontSize()
}

/**
 * 设置宽度
 * @param size  px
 * @returns dp
 */
export function scaleSizeW(size: number) {
  // console.log(screenPxW / designWidth)
  // let scaleWidth = size * Math.min(screenPxW / designWidth, 3.1)
  let scaleWidth = size * scale
  size = Math.floor(scaleWidth / pixelRatio)
  return size * appliedFontSize()
}

export const scaleSizeAbsHR = (size: number) => {
  let scaleHeight = size * scale
  return size * 2 - Math.floor(scaleHeight / pixelRatio)
}
