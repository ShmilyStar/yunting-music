export const HEADER_HEIGHT = 42
export const LIST_ITEM_HEIGHT = 54
export const LIST_SCROLL_POSITION_KEY = '__LIST_SCROLL_POSITION_KEY__'

export const SPLIT_CHAR = {
  DISLIKE_NAME: '@',
  DISLIKE_NAME_ALIAS: '#',
} as const

export const LIST_IDS = {
  DEFAULT: 'default',
  LOVE: 'love',
  TEMP: 'temp',
  DOWNLOAD: 'download',
  PLAY_LATER: null,
} as const

// export const COMPONENT_IDS = {
//   home: 'home',
//   playDetail: 'playDetail',
// } as const
// export type COMPONENT_IDS_TYPE = keyof typeof COMPONENT_IDS
export enum COMPONENT_IDS {
  home = 'home',
  playDetail = 'playDetail',
  songlistDetail = 'songlistDetail',
  comment = 'comment',
}

export enum NAV_SHEAR_NATIVE_IDS {
  playDetail_pic = 'playDetail_pic',
  playDetail_header = 'playDetail_header',
  // playDetail_pageIndicator = 'playDetail_pageIndicator',
  playDetail_player = 'playDetail_player',
  songlistDetail_pic = 'songlistDetail_pic',
  songlistDetail_title = 'songlistDetail_title',
}


export const storageDataPrefix = {
  setting: '@setting_v1',
  userList: '@user_list',
  viewPrevState: '@view_prev_state',
  recentPlay: '@recent_play',

  list: '@list__',
  listScrollPosition: '@list_scroll_position',
  listPrevSelectId: '@list_prev_select_id',

  lyric: '@lyric__',
  musicUrl: '@music_url__',
  musicOtherSource: '@music_other_source__',
  playInfo: '@play_info',

  syncAuthKey: '@sync_auth_key',
  syncHost: '@sync_host',
  syncHostHistory: '@sync_host_history',

  openStoragePath: '@open_storage_path',
  selectedManagedFolder: '@selected_managed_folder',
  localMusicDirs: '@local_music_dirs',
  notificationTipEnable: '@notification_tip_enable',
  ignoringBatteryOptimizationTipEnable: '@ignoring_battery_optimization_tip_enable',

  searchHistoryList: '@search_history_list',
  listUpdateInfo: '@list_update_info',
  ignoreVersion: '@ignore_version',
  ignoreVersionFailTipTimeKey: '@ignore_version_fail_tip_time',
  leaderboardSetting: '@leaderboard_setting',
  songListSetting: '@songist_setting',
  searchSetting: '@search_setting',

  fontSize: '@font_size',

  theme: '@theme',

  cheatTip: '@cheat_tip',
  remoteLyricTip: '@remote_lyric_tip',

  dislikeList: '@dislike_list',

  userApi: '@user_api__',

  downloadList: '@download_list__',
} as const

// v0.x.x 版本的 data keys
export const storageDataPrefixOld = {
  setting: '@setting',
  list: '@list__',
  listPosition: '@listposition__',
  listSort: '@listsort__',
  // lyric: '@lyric__',
  // musicUrl: '@music_url__',
  playInfo: '@play_info',
  syncAuthKey: '@sync_auth_key',
  syncHost: '@sync_host',
  syncHostHistory: '@sync_host_history',
  notificationTipEnable: '@notification_tip_enable',
} as const

export const APP_PROVIDER_NAME = 'cn.toside.ytmusic.mobile.provider'


/**
 * 主页 PagerView 的页面表：**下标即顺序，不可变**。
 *
 * 0~2 是三个主 Tab（底部栏常驻），3~12 是二级页；导航只切下标，页面常驻不卸载。
 */
export const NAV_MENUS = [
  { id: 'nav_discover', icon: 'compass-outline' },
  { id: 'nav_mine', icon: 'account-circle-outline' },
  { id: 'nav_search', icon: 'search-2' },
  { id: 'nav_songlist', icon: 'album' },
  { id: 'nav_top', icon: 'leaderboard' },
  { id: 'nav_love', icon: 'love' },
  { id: 'nav_setting', icon: 'setting' },
  { id: 'nav_recent', icon: 'history' },
  { id: 'nav_board_songs', icon: 'chart-bar' },
  // 「已下载」页面已移除（下载目录改成本地歌曲页的第一行），这里保留 id 占位，
  // 不打乱既有下标；新增页面一律追加在末尾
  { id: 'nav_download', icon: 'download-circle-outline' },
  // 本地音乐页（同样追加在末尾，保证既有下标不变）
  { id: 'nav_local_music', icon: 'music-box-outline' },
] as const

export type NAV_ID_Type = typeof NAV_MENUS[number]['id']

/** 三个主 Tab 在 PagerView 里的下标 */
export const MAIN_TAB_INDEXES = [0, 1, 2] as const

export const YTM_FILE_EXT_RXP = ['json', 'ytmc', 'bin']
// 兼容旧命名（上游遗留的 .lxmc 语义）
export const LXM_FILE_EXT_RXP = YTM_FILE_EXT_RXP
export const USER_API_SOURCE_FILE_EXT_RXP = ['js']

export const MUSIC_TOGGLE_MODE = {
  listLoop: 'listLoop', // 列表循环
  random: 'random', // 列表随机
  list: 'list', // 顺序播放
  singleLoop: 'singleLoop', // 单曲循环
  none: 'none', // 禁用
} as const

export const MUSIC_TOGGLE_MODE_LIST = [
  MUSIC_TOGGLE_MODE.listLoop,
  MUSIC_TOGGLE_MODE.random,
  MUSIC_TOGGLE_MODE.list,
  MUSIC_TOGGLE_MODE.singleLoop,
  MUSIC_TOGGLE_MODE.none,
] as const

export const DEFAULT_SETTING = {
  /**
   * 首次安装（还没有持久化设置）时的默认源统一为 **KG**（用户 2026-10-21 要求）。
   *
   * - `leaderboard.boardId` 必须是 KG 榜单列表里的第一个（`kg__8888`）：
   *   源和榜单 id 不匹配（如 source=kg 但 boardId 是 kw 的）时，
   *   榜单页会按 kg 去请求一个 kw 的单号，直接拿到空列表。
   * - `songList.sortId` 用 KG 排序表的第一项（`5` = 推荐），
   *   各源的排序 id 不通用，填 kw 的 `new` 同样会拿到空列表。
   */
  leaderboard: {
    source: 'kg' as LX.OnlineSource,
    boardId: 'kg__8888',
  },

  songList: {
    source: 'kg' as LX.OnlineSource,
    sortId: '5',
    tagName: '',
    tagId: '',
  },

  search: {
    temp_source: 'kg' as LX.OnlineSource,
    source: 'all' as LX.OnlineSource | 'all',
    type: 'music' as 'music' | 'songlist',
  },

  viewPrevState: {
    id: 'nav_discover' as NAV_ID_Type,
    // query: {},
  },
}
