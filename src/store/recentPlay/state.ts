/**
 * 最近播放 store 的内存状态。
 *
 * 只保存**在线歌曲**（`LX.Music.MusicInfoOnline`）：最近播放页点歌时要把
 * 整个列表写进临时列表（`setTempList` 只接受在线歌曲），本地歌曲没有
 * 可复用的在线信息，记录阶段就被过滤掉了（见 `core/recentPlay.ts`）。
 */
export interface InitState {
  /** 最近播放列表，最近播放的在最前 */
  recentList: LX.Music.MusicInfoOnline[]
}

const state: InitState = {
  recentList: [],
}

export default state
