import { memo, type ReactNode } from 'react'

import Basic from './settings/Basic'
import Theme from './settings/Theme'
import Language from './settings/Basic/Language'
import FontSize from './settings/Basic/FontSize'
import Player from './settings/Player'
import Lyric from './settings/Lyric'
import LyricDesktop from './settings/LyricDesktop'
import List from './settings/List'
import Search from './settings/Search'
import Backup from './settings/Backup'
import Sync from './settings/Sync'
import Source from './settings/Basic/Source'
import SourceName from './settings/Basic/SourceName'
import Download from './settings/Download'
import Other from './settings/Other'
import Log from './settings/Other/Log'
import About from './settings/About'
import Version from './settings/Version'
import Section from './components/Section'
import { useI18n, type Message } from '@/lang'
import { isDesktopLyricSupported } from '@/config/platform'
import { isDownloadSupported } from '@/core/download'

/**
 * 设置分组 id。
 * 改成单列长滚动后不再用于切换页面，仅保留类型
 * （`types/app.d.ts` 的 `global.lx.settingActiveId` 仍引用它）。
 */
export type SettingScreenIds =
  | 'basic' | 'player' | 'lyric_desktop' | 'search' | 'list'
  | 'download' | 'sync' | 'backup' | 'other' | 'version' | 'about'

export interface SettingGroup {
  id: string
  /** 左侧分栏与分组标题用的键 */
  labelKey: I18nKey
  node: ReactNode
}

/** i18n 键（受三套语言文件约束） */
type I18nKey = keyof Message

/**
 * 设置分组表（03 §11 的顺序）。
 *
 * 单列长滚动与平板横屏分栏（07 §3.5）共用这一份数据：前者全部渲染，
 * 后者只渲染选中项。分组标题由各自的 Section / SubTitle 自带。
 */
export const SETTING_GROUPS: SettingGroup[] = [
  { id: 'basic', labelKey: 'setting_basic', node: <Basic /> },
  { id: 'theme', labelKey: 'setting_basic_theme', node: <Theme /> },
  { id: 'language', labelKey: 'setting_basic_lang', node: <Language /> },
  { id: 'fontSize', labelKey: 'setting_basic_font_size', node: <FontSize /> },
  { id: 'player', labelKey: 'setting_player', node: <Player /> },
  { id: 'lyric', labelKey: 'setting_lyric', node: <Lyric /> },
  ...(isDesktopLyricSupported
    ? [{ id: 'lyricDesktop', labelKey: 'setting_lyric_desktop' as I18nKey, node: <LyricDesktop /> }]
    : []),
  { id: 'list', labelKey: 'setting_list', node: <List /> },
  { id: 'search', labelKey: 'setting_search', node: <Search /> },
  { id: 'backup', labelKey: 'setting_backup', node: <Backup /> },
  { id: 'sync', labelKey: 'setting_sync', node: <Sync /> },
  { id: 'source', labelKey: 'setting_basic_source', node: <Source /> },
  { id: 'sourceName', labelKey: 'setting_basic_sourcename', node: <SourceName /> },
  // 下载两端都支持（Android 走进程内下载，iOS 走 NSURLSession 后台会话），
  // 统一用能力开关而不是散落的 `Platform.OS == 'ios'`
  ...(isDownloadSupported()
    ? [{ id: 'download', labelKey: 'setting_download' as I18nKey, node: <Download /> }]
    : []),
  { id: 'other', labelKey: 'setting_other', node: <Other /> },
  // 日志组的标题由 Section 在外层给出（见 SettingGroupBody），这里 node 留空
  { id: 'log', labelKey: 'setting_log', node: null },
  { id: 'version', labelKey: 'setting_version', node: <Version /> },
  { id: 'about', labelKey: 'setting_about', node: <About /> },
]

/**
 * 设置页内容（03 §11）：单列长滚动 + 分组标题。
 *
 * 分组顺序：基本设置 → 主题颜色 → 语言 → 字体大小 →
 * 播放器设置 → 歌词设置 → 桌面歌词（仅 Android）→ 列表设置 → 搜索设置 →
 * 备份与恢复 → 数据同步 → 用户自定义源 → 下载设置（仅 iOS）→ 其他 → 日志 →
 * 软件更新 → 关于。
 */
export default memo(() => {
  return (
    <>
      {SETTING_GROUPS.map(group => (
        <SettingGroupBody key={group.id} group={group} />
      ))}
    </>
  )
})

/** 单个分组的内容（分栏布局下只渲染选中项，所以单独抽出来） */
export const SettingGroupBody = memo(({ group }: { group: SettingGroup }) => {
  const t = useI18n()
  // 日志组的标题由 Section 在外层给出，这里保证语言切换后能刷新
  if (group.id == 'log') {
    return <Section title={t('setting_log')}><Log /></Section>
  }
  return <>{group.node}</>
})
