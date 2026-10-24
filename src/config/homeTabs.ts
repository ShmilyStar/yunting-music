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

/** 底部两个主 Tab（顺序即底部栏从左到右） */
export const HOME_TABS = [
  { id: 'nav_discover', icon: 'compass-outline', labelKey: 'tab_discover' },
  { id: 'nav_mine', icon: 'account-circle-outline', labelKey: 'tab_mine' },
] as const

export type HOME_TAB_ID = typeof HOME_TABS[number]['id']

const HOME_TAB_IDS: readonly string[] = HOME_TABS.map(t => t.id)

export const isHomeTabId = (id: string): id is HOME_TAB_ID => HOME_TAB_IDS.includes(id)

/** 我的页四宫格：我的列表 / 我的歌单 / 本地歌曲 / 最近播放 */
export const MINE_SECTIONS: ReadonlyArray<{
  id: 'song' | 'songlist' | 'local' | 'recent'
  icon: string
  labelKey: I18nKey
  accent: RefAccentKey
  unitKey: I18nKey
}> = [
  /**
   * 「我的列表」统计的是**列表条目数**（我的收藏 + 自建列表），所以单位是
   * 「个」而不是「首」（用户 2026-10-24 要求：改名「我的歌曲」→「我的列表」，
   * 单位「首」→「个」）。
   */
  { id: 'song', icon: 'heart', labelKey: 'mine_song', accent: 'red', unitKey: 'mine_unit_list' },
  { id: 'songlist', icon: 'playlist-music', labelKey: 'mine_songlist', accent: 'orange', unitKey: 'mine_unit_songlist' },
  { id: 'local', icon: 'folder-music-outline', labelKey: 'hall_local_music', accent: 'purple', unitKey: 'mine_unit_local' },
  { id: 'recent', icon: 'history', labelKey: 'hall_recent', accent: 'teal', unitKey: 'mine_unit_recent' },
]

export type MineSectionId = typeof MINE_SECTIONS[number]['id']
