import music from '@/utils/musicSdk'

export declare type Source = LX.OnlineSource

export declare interface BoardItem {
  id: string
  name: string
  bangid: string
}
export declare interface Board {
  list: BoardItem[]
  source: LX.OnlineSource
}
type Boards = Partial<Record<LX.OnlineSource, Board>>

export declare interface ListDetailInfo {
  list: LX.Music.MusicInfoOnline[]
  total: number
  maxPage: number
  page: number
  source: LX.OnlineSource | null
  limit: number
  key: string | null
  id: string
}

export interface InitState {
  sources: LX.OnlineSource[]
  boards: Boards
  listDetailInfo: ListDetailInfo
  /**
   * 当前榜单名。
   *
   * **没有事件通知的普通字段**：排行榜页在跳转「榜单歌曲」页之前直接赋值
   * （或经 `leaderboardActions.setActiveBoardName`），榜单歌曲页的标题组件
   * 靠订阅导航变化来读取它（见 `screens/Home/Views/BoardSongs`）。
   */
  activeBoardName: string
}

const state: InitState = {
  sources: [],
  boards: {},
  activeBoardName: '',
  listDetailInfo: {
    list: [],
    total: 0,
    page: 1,
    maxPage: 1,
    limit: 30,
    key: null,
    source: null,
    id: '',
  },
}

for (const source of music.sources) {
  if (!music[source.id as LX.OnlineSource]?.leaderboard?.getBoards) continue
  state.sources.push(source.id as LX.OnlineSource)
}


export default state
