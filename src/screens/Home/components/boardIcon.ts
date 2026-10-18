import { type RefAccentKey } from '@/config/uiPalette'

/**
 * 音源榜单接口只返回 id 与名称、没有封面图，
 * 因此按榜单名做关键词匹配，配柔和底色拼出缩略图。**完全本地计算，不联网。**
 */

/** 配色循环（发现页卡片与排行榜列表共用，保证观感一致） */
export const BOARD_ACCENT_ORDER: RefAccentKey[] =
  ['green', 'orange', 'red', 'deepOrange', 'teal', 'indigo', 'blue', 'pink']

export const BOARD_ICONS: Array<[RegExp, string]> = [
  [/飙升|上升|趋势|潜力/, 'trending-up'],
  [/热歌|热播|热门|热评|听歌识曲|赏音/, 'fire'],
  [/新歌|新碟|新专辑/, 'star-outline'],
  [/电音|DJ|舞曲|嗨|beatport|BEAT/i, 'disc'],
  [/说唱|嘻哈|rap/i, 'microphone-variant'],
  [/摇滚/, 'guitar-electric'],
  [/民谣|古风|古典|纯音乐|国风|乡村|爵士|R&B/i, 'music-note'],
  [/欧美|日韩|日本|韩国|港台|台湾|香港|内地|华语|粤语|闽南|越南|泰国|泰语|俄语|小语种|全球|UK|Billboard|iTunes|Melon|Oricon|Genie|KKBOX|Hito|SPACE/i, 'earth'],
  [/会员|VIP|黑胶|臻爱/, 'crown-outline'],
  [/影视|电视|综艺|K歌|动画|动漫|游戏/, 'movie-open-outline'],
  [/原创|音乐人|编辑推荐|5sing|繁星/, 'pencil-outline'],
  [/儿歌|童|校园/, 'baby-face-outline'],
  [/铃声|彩铃|分贝/, 'bell-outline'],
]

/** 匹配不到时用奖台图标兜底 */
export const getBoardIcon = (name: string): string => {
  for (const [rule, icon] of BOARD_ICONS) {
    if (rule.test(name)) return icon
  }
  return 'podium'
}

/** 名称哈希取色，保证同一榜单每次进页面颜色一致 */
export const getBoardAccent = (name: string, listSize: number): RefAccentKey => {
  if (listSize <= 0) return BOARD_ACCENT_ORDER[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000
  return BOARD_ACCENT_ORDER[hash % BOARD_ACCENT_ORDER.length]
}
