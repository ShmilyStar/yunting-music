/**
 * 主页外壳的导航定义：底部三个主 Tab、新增二级页、以及三个主 Tab 页内的宫格配置。
 *
 * PagerView 下标顺序由 `src/screens/Home/Vertical/Main.tsx` 的 PAGES 决定，
 * 这里只描述「有哪些 Tab / 哪些入口」，不描述顺序。
 */
import { type RefAccentKey } from './uiPalette'
import { type Message } from '@/lang'

/** i18n 键（受三套语言文件约束，写错会在类型检查时暴露） */
export type I18nKey = keyof Message

/** 底部三个主 Tab（顺序即底部栏从左到右） */
export const HOME_TABS = [
  { id: 'nav_discover', icon: 'compass-outline', labelKey: 'tab_discover' },
  { id: 'nav_hall', icon: 'music-box-multiple-outline', labelKey: 'tab_hall' },
  { id: 'nav_mine', icon: 'account-circle-outline', labelKey: 'tab_mine' },
] as const

export type HOME_TAB_ID = typeof HOME_TABS[number]['id']

const HOME_TAB_IDS: readonly string[] = HOME_TABS.map(t => t.id)

export const isHomeTabId = (id: string): id is HOME_TAB_ID => HOME_TAB_IDS.includes(id)

export const HOME_TAB_DEFAULT: HOME_TAB_ID = 'nav_discover'

/** 发现页四个快捷入口 */
export const DISCOVER_QUICK_ENTRIES: ReadonlyArray<{
  id: 'random' | 'love' | 'recent' | 'search'
  icon: string
  labelKey: I18nKey
  accent: RefAccentKey
}> = [
  { id: 'random', icon: 'shuffle-variant', labelKey: 'discover_random_play', accent: 'green' },
  { id: 'love', icon: 'heart-outline', labelKey: 'discover_my_love', accent: 'red' },
  { id: 'recent', icon: 'history', labelKey: 'discover_recent_play', accent: 'blue' },
  { id: 'search', icon: 'magnify', labelKey: 'discover_search', accent: 'orange' },
]

/** 音乐馆宫格：歌曲 / 歌单 / 排行榜 / 歌手 / 专辑 / 下载管理 / 最近播放 */
export const HALL_CATEGORIES: ReadonlyArray<{
  id: 'song' | 'songlist' | 'leaderboard' | 'singer' | 'album' | 'download' | 'recent'
  icon: string
  labelKey: I18nKey
  page: string
  accent: RefAccentKey
}> = [
  { id: 'song', icon: 'music-note', labelKey: 'hall_song', page: 'nav_hot_songs', accent: 'green' },
  { id: 'songlist', icon: 'playlist-music', labelKey: 'hall_songlist', page: 'nav_songlist', accent: 'orange' },
  { id: 'leaderboard', icon: 'chart-bar', labelKey: 'hall_leaderboard', page: 'nav_top', accent: 'deepOrange' },
  { id: 'singer', icon: 'account-music', labelKey: 'hall_singer', page: 'nav_singers', accent: 'teal' },
  { id: 'album', icon: 'album', labelKey: 'hall_album', page: 'nav_albums', accent: 'indigo' },
  { id: 'download', icon: 'download-circle-outline', labelKey: 'hall_download', page: 'nav_download', accent: 'pink' },
  { id: 'recent', icon: 'history', labelKey: 'hall_recent', page: 'nav_recent', accent: 'blue' },
]

/** 我的页四宫格 */
export const MINE_SECTIONS: ReadonlyArray<{
  id: 'song' | 'songlist' | 'album' | 'singer'
  icon: string
  labelKey: I18nKey
  accent: RefAccentKey
  unitKey: I18nKey
}> = [
  { id: 'song', icon: 'heart', labelKey: 'mine_song', accent: 'red', unitKey: 'mine_count_unit' },
  { id: 'songlist', icon: 'playlist-music', labelKey: 'mine_songlist', accent: 'orange', unitKey: 'mine_unit_songlist' },
  { id: 'album', icon: 'album', labelKey: 'mine_album', accent: 'indigo', unitKey: 'mine_unit_album' },
  { id: 'singer', icon: 'account-music', labelKey: 'mine_singer', accent: 'teal', unitKey: 'mine_unit_singer' },
]

export type MineSectionId = typeof MINE_SECTIONS[number]['id']
