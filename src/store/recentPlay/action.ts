import state from './state'

/**
 * 最近播放列表的所有变更都经这里落到内存并广播。
 * 持久化由 `core/recentPlay.ts` 负责，store 层不碰存储。
 */
export default {
  /** 整体覆盖最近播放列表 */
  setRecentList(list: LX.Music.MusicInfoOnline[]) {
    state.recentList = list
    global.state_event.recentPlayUpdated([...list])
  },
}
