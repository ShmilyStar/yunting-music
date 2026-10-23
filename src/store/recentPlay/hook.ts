import { useEffect, useState } from 'react'
import state from './state'

/**
 * 订阅最近播放列表（最近播放的在最前）。
 *
 * 持久化的首次读盘由 `core/recentPlay.ts` 的 `initRecentPlay()` 触发，
 * 这里只负责订阅变更。
 */
export const useRecentPlay = () => {
  const [list, setList] = useState(state.recentList)

  useEffect(() => {
    const handleUpdate = (list: LX.Music.MusicInfoOnline[]) => {
      setList(list)
    }
    global.state_event.on('recentPlayUpdated', handleUpdate)
    return () => {
      global.state_event.off('recentPlayUpdated', handleUpdate)
    }
  }, [])

  return list
}
