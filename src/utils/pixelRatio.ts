/**
 * Created by qianxin on 17/6/1.
 * 屏幕工具类
 * ui设计基准,iphone 6
 * width:375
 * height:667
 */
import { PixelRatio } from 'react-native'
import { windowSizeTools } from './windowSizeTools'

// 高保真的宽度和高度
const designWidth = 375.0
const designHeight = 667.0

// 获取屏幕的dp
const size = windowSizeTools.getSize()
// console.log('size', size)
let screenW = size.width
let screenH = size.height
if (screenW > screenH) {
  const temp = screenW
  screenW = screenH
  screenH = temp
}
let fontScale = PixelRatio.getFontScale()
let pixelRatio = PixelRatio.get()
// 根据dp获取屏幕的px
let screenPxW = PixelRatio.getPixelSizeForLayoutSize(screenW)
let screenPxH = PixelRatio.getPixelSizeForLayoutSize(screenH)
// console.log(screenPxW, screenPxH)

const scaleW = screenPxW / designWidth
const scaleH = screenPxH / designHeight
let scale = Math.min(scaleW, scaleH, 3.1)
// console.log(scale)

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * 是否平板布局。
 *
 * 判据是「最短边 ≥ 600dp **且** 长宽比 < 1.9」。
 * 只按最短边判会把 600×1332dp 这类长条大屏手机也当成平板，而平板分支用的是
 * 更收敛的系数（控件 1.28、文字 1.08），标题栏与正文在大屏手机上会明显偏小。
 * 16:9（1.78）、4:3（1.33）的平板照旧；18:9 以上的长条屏走手机档。
 */
export const isTabletLayout = screenW >= 600 && screenH / screenW < 1.9

/** 平板控件系数：600dp 级 1.28 / 720dp 级 1.42 / 1080dp 级 1.72 */
const getTabletRatio = () => clamp((screenW / designWidth) * 0.74, 1.28, 1.72)
/** 平板文字系数：与控件同趋势但更收敛 */
const getTabletTextRatio = () => clamp((screenW / designWidth) * 0.60, 1.08, 1.32)

// 平板上控件也要收敛，否则大屏上图标与模块会被放大到失衡
if (isTabletLayout) scale = Math.min(scale, getTabletRatio() * pixelRatio)

/**
 * 设置text
 * @param size  px
 * @returns dp
 */
export function getTextSize(size: number) {
  // console.log('screenW======' + screenW)
  // console.log('screenPxW======' + screenPxW)
  let scaleWidth = screenW / designWidth
  let scaleHeight = screenH / designHeight
  // console.log(scaleWidth, scaleHeight)
  let scale = Math.min(scaleWidth, scaleHeight, 1.3)
  // 文字刻意不与控件等比放大：平板另取更收敛的系数
  if (isTabletLayout) scale = Math.min(scale, getTabletTextRatio())
  size = Math.floor(size * scale / fontScale)
  // console.log(size)
  return size
}
export function setSpText(size: number) {
  return getTextSize(size) * global.lx.fontSize
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
  return size * global.lx.fontSize
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
  return size * global.lx.fontSize
}

export const scaleSizeAbsHR = (size: number) => {
  let scaleHeight = size * scale
  return size * 2 - Math.floor(scaleHeight / pixelRatio)
}
