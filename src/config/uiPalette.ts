/**
 * 新 UI（发现 / 音乐馆 / 我的 / 播放列表弹层 / mini 播放条）专用调色板。
 *
 * 这一套是**硬编码浅色值**，不读主题变量：
 * 参考实现里这三个主 Tab 的观感与主题色解耦，用户换主题色只影响二级页与既有组件。
 */

export const REF_COLOR = {
  primary: '#31C27C',
  pageBg: '#F6F7F9',
  cardBg: '#F6FBF4',
  cardBgAlt: '#FFFFFF',
  text: '#181D19',
  textSub: '#666666',
  textHint: '#9E9E9E',
  divider: 'rgba(24, 29, 25, 0.06)',
  /** 底部 Tab 选中胶囊底色 */
  pillActive: 'rgba(49, 194, 124, 0.16)',
} as const

export const REF_ACCENT = {
  green: { color: '#31C27C', bg: '#E2F6ED' },
  red: { color: '#FF5252', bg: '#F7E3E5' },
  blue: { color: '#448AFF', bg: '#E0EAFA' },
  orange: { color: '#FFAB40', bg: '#F7EEE3' },
  deepOrange: { color: '#FF5722', bg: '#FDECE6' },
  teal: { color: '#009688', bg: '#E0F2F1' },
  indigo: { color: '#3F51B5', bg: '#E8EAF6' },
  pink: { color: '#E91E63', bg: '#FCE4EC' },
  purple: { color: '#7E57C2', bg: '#EDE7F6' },
} as const

export type RefAccentKey = keyof typeof REF_ACCENT

