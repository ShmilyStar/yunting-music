import { type Lines } from 'lrc-file-parser'

/** 歌词行高表 + 头尾占位块高度（与 `PlayLine` / 两个歌词组件共用） */
export interface LyricLayoutInfo {
  spaceHeight: number
  lineHeights: number[]
}

/** 播放行固定在可视高度的这个比例处（两个歌词组件与 `PlayLine` 一致） */
export const LYRIC_PLAY_LINE_RATIO = 0.42

/**
 * 播放行画在可视高度的百分比字符串，`PlayLine` 的 `top` 用它。
 *
 * 与 `LYRIC_PLAY_LINE_RATIO` 是同一个数的两种写法：换算用数字、样式用
 * 百分比。以前样式写死 40%、换算按 42% 算，播放线与「哪一句算当前句」
 * 差着一截（滑到播放线上的那句和实际跳过去的句不同）。
 */
export const LYRIC_PLAY_LINE_TOP = `${LYRIC_PLAY_LINE_RATIO * 100}%` as const

/**
 * 把「列表滚动位置」换算成播放时间（ms）——「允许通过拖拽歌词调整播放
 * 进度」的核心换算。
 *
 * 播放行画在 `playLineRatio` 处，落在该位置的那一句就是当前时间；
 * 再按该句内已滚过的比例在「本句起点 → 下一句起点」之间线性插值，
 * 让慢拖也能落在句子中间，而不是整句整句地跳。
 *
 * 最后一句没有「下一句」，只能返回它的起点（歌词播完的时间不可知）。
 *
 * @param offsetY 列表内容偏移
 * @param viewportHeight 列表可视高度
 * @param layout 行高表/占位块高度；行高还没量到时返回 `null`
 * @param lines 解析后的歌词
 * @returns 目标时间（ms），无法换算时为 `null`
 */
export const offsetToLyricTime = (
  offsetY: number,
  viewportHeight: number,
  layout: LyricLayoutInfo,
  lines: Lines,
  playLineRatio = LYRIC_PLAY_LINE_RATIO,
): number | null => {
  if (!lines.length) return null
  // 行高还没全部量到（首帧 / 刚换歌词）时，任何换算都是猜的
  if (!layout.lineHeights.length) return null

  const target = offsetY + viewportHeight * playLineRatio
  let lineTop = layout.spaceHeight
  let index = -1
  for (let i = 0; i < layout.lineHeights.length; i++) {
    const height = layout.lineHeights[i] ?? 0
    if (lineTop + height >= target) {
      index = i
      break
    }
    lineTop += height
  }
  // 播放行落在最后一行之后（列表底部占位区）：按最后一句算
  if (index == -1) index = layout.lineHeights.length - 1

  const current = lines[index]
  if (!current) return null
  const next = lines[index + 1]
  if (!next) return current.time

  const height = layout.lineHeights[index] ?? 0
  if (height <= 0) return current.time
  const ratio = Math.min(Math.max((target - lineTop) / height, 0), 1)
  return Math.round(current.time + (next.time - current.time) * ratio)
}
