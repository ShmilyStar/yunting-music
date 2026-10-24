import { updatePlayIndex } from '@/core/player/playInfo'
import { throttleBackgroundTimer } from '@/utils/tools'
import playerState from '@/store/player/state'

const changedListIds = new Set<string | null>()

/**
 * 播放队列内容变化后的索引校正。
 *
 * 历史行为：正在播放的歌被从列表里移除（`playIndex < 0`）时直接 `playNext(true)`
 * 跳下一首。但「取消收藏」这类操作也会移除当前歌曲 —— 用户只是取消了收藏，
 * 并不想被打断：**应当继续放完当前这首，播完再按列表继续**（用户 2026-10-24
 * 反馈「我的歌曲下歌单里取消收藏后就自动换歌」）。
 *
 * 现在只校正索引，不再主动切歌。播放中的音频由 track-player 自己持有着，
 * 列表里没有这首歌也不影响它继续播；`playNext` 会按当前列表取下一首。
 * `playInfo.playIndex` 变成 -1，正好表示「当前曲不在列表里」，进度与播放按钮
 * 都按 `playerState` 走，不受影响。
 */
export default () => {
  const throttleListChange = throttleBackgroundTimer(() => {
    const isSkip = !changedListIds.has(playerState.playInfo.playerListId) && !changedListIds.has(playerState.playMusicInfo.listId)
    changedListIds.clear()
    if (isSkip) return

    // 只重算索引：歌曲被移除时得到 -1，不做任何切歌动作
    updatePlayIndex()
  })

  const handleListChange = (listIds: string[]) => {
    for (const id of listIds) {
      changedListIds.add(id)
    }
    throttleListChange()
  }

  const handleDownloadListChange = () => {
    handleListChange(['download'])
  }

  global.app_event.on('myListMusicUpdate', handleListChange)
  global.app_event.on('downloadListUpdate', handleDownloadListChange)
}
