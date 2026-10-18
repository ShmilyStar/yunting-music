import { useEffect, useState } from 'react'
import state, { type InitState } from './state'
import { getListMusics } from '@/core/list'
import { LIST_IDS } from '@/config/constant'

export const useMyList = () => {
  const [lists, setList] = useState(state.allList)
  lists[0].name = global.i18n.t('list_name_default')
  lists[1].name = global.i18n.t('list_name_love')

  useEffect(() => {
    const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.langId')) return
      setList((lists) => {
        lists[0].name = global.i18n.t('list_name_default')
        lists[1].name = global.i18n.t('list_name_love')
        return [...lists]
      })
    }
    global.state_event.on('mylistUpdated', setList)
    global.state_event.on('configUpdated', handleConfigUpdate)
    return () => {
      global.state_event.off('mylistUpdated', setList)
      global.state_event.off('configUpdated', handleConfigUpdate)
    }
  }, [])

  return lists
}

export const useActiveListId = () => {
  const [id, setId] = useState(state.activeListId)

  useEffect(() => {
    global.state_event.on('mylistToggled', setId)
    return () => {
      global.state_event.off('mylistToggled', setId)
    }
  }, [])

  return id
}


export const useMusicList = () => {
  const [list, setList] = useState<LX.List.ListMusics>([])

  useEffect(() => {
    const handleToggle = (activeListId: string) => {
      void getListMusics(activeListId).then((list) => {
        setList([...list])
      })
    }
    const handleChange = (ids: string[]) => {
      if (!ids.includes(state.activeListId)) return
      void getListMusics(state.activeListId).then((list) => {
        setList([...list])
      })
    }
    global.state_event.on('mylistToggled', handleToggle)
    global.app_event.on('myListMusicUpdate', handleChange)

    handleToggle(state.activeListId)

    return () => {
      global.state_event.off('mylistToggled', handleToggle)
      global.app_event.off('myListMusicUpdate', handleChange)
    }
  }, [])

  return list
}

export const useMusicExistsList = (list: LX.List.MyListInfo, musicInfo: LX.Music.MusicInfo) => {
  const [isExists, setExists] = useState(false)

  useEffect(() => {
    void getListMusics(list.id).then((musics) => {
      setExists(musics.some(s => s.id == musicInfo.id))
    })
  }, [list.id, musicInfo.id])

  return isExists
}

/**
 * 当前歌曲是否已在「我的收藏」里。
 *
 * 与 `useMusicExistsList` 的差别：这里**订阅列表更新事件**，
 * 在别处收藏/取消收藏后，播放页与 mini 条上的爱心会跟着刷新。
 */
export const useMusicInLoveList = (musicInfo: LX.Music.MusicInfo | null | undefined) => {
  const [isLoved, setLoved] = useState(false)
  const id = musicInfo?.id

  useEffect(() => {
    if (!id) {
      setLoved(false)
      return
    }
    let cancelled = false
    const check = () => {
      void getListMusics(LIST_IDS.LOVE).then((musics) => {
        if (cancelled) return
        setLoved(musics.some(m => m.id === id))
      })
    }
    check()
    const handleMusicUpdate = (ids: string[]) => {
      if (ids.includes(LIST_IDS.LOVE)) check()
    }
    const handleListUpdate = () => { check() }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    global.state_event.on('mylistUpdated', handleListUpdate)
    return () => {
      cancelled = true
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
      global.state_event.off('mylistUpdated', handleListUpdate)
    }
  }, [id])

  return isLoved
}

export const useListFetching = (listId: string) => {
  const [fetching, setFetching] = useState(!!state.fetchingListStatus[listId])

  useEffect(() => {
    let prevStatus = state.fetchingListStatus[listId]
    const handleUpdate = (status: InitState['fetchingListStatus']) => {
      let currentStatus = status[listId]
      if (currentStatus == null || prevStatus == status[listId]) return
      setFetching(prevStatus = currentStatus)
    }
    global.state_event.on('fetchingListStatusUpdated', handleUpdate)
    return () => {
      global.state_event.off('fetchingListStatusUpdated', handleUpdate)
    }
  }, [listId])

  return fetching
}

