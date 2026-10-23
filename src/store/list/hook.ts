import { useEffect, useMemo, useState } from 'react'
import state, { type InitState } from './state'
import { getListMusics } from '@/core/list'
import { LIST_IDS } from '@/config/constant'

export const useMyList = () => {
  const [lists, setList] = useState(state.allList)
  /** 语言切换时 +1，用来触发下面的派生重算 */
  const [langTick, setLangTick] = useState(0)

  useEffect(() => {
    const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.langId')) return
      // 语言变化只更新触发重算的标记，不再就地改写全局 store 的对象
      setLangTick(tick => tick + 1)
      setList([...state.allList])
    }
    global.state_event.on('mylistUpdated', setList)
    global.state_event.on('configUpdated', handleConfigUpdate)
    return () => {
      global.state_event.off('mylistUpdated', setList)
      global.state_event.off('configUpdated', handleConfigUpdate)
    }
  }, [])

  // 默认 / 收藏两个列表的名字是本地化文案，**派生**出来而不是写回 store：
  // lists 就是 state.allList 本体，渲染期改写会污染所有页面共享的数据。
  // langTick 是切语言时的重算信号（名字依赖全局 i18n，hook 无法静态表达），
  // 用 `langTick` 参与计算而不是只放进依赖，避免被 lint 判成多余依赖。
  return useMemo(() => {
    void langTick
    return lists.map((list): LX.List.MyListInfo => {
      // 默认 / 收藏的名字是本地化文案：类型里这两个字段被收窄成字面量
      // （上游设计），语言切换时需要覆盖，所以这里显式断言
      if (list.id == LIST_IDS.DEFAULT) {
        return { ...list, name: global.i18n.t('list_name_default') as LX.List.MyDefaultListInfo['name'] }
      }
      if (list.id == LIST_IDS.LOVE) {
        return { ...list, name: global.i18n.t('list_name_love') as LX.List.MyLoveListInfo['name'] }
      }
      return list
    })
  }, [lists, langTick])
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

/**
 * 当前歌曲是否已被收藏到**任意**歌单（含「我的收藏」）。
 *
 * 用于 mini 条与主播放页的「收藏到歌单」爱心：用户 2026-10-21 要求
 * 「只要歌曲被收藏，不管是收藏到哪个歌单，空心就变实心」。
 *
 * 判定口径与「添加到歌单」弹窗一致：按 `music.id` 命中任一列表即算已收藏。
 * 逐个列表读会走 `core/list` 的缓存，命中一个就停，不会把代价堆到列表总数上。
 */
export const useMusicInAnyList = (musicInfo: LX.Music.MusicInfo | null | undefined) => {
  const [isIn, setIsIn] = useState(false)
  const id = musicInfo?.id

  useEffect(() => {
    if (!id) {
      setIsIn(false)
      return
    }
    let cancelled = false
    const check = async() => {
      /**
       * 只看「收藏」与自建歌单：**必须排除试听列表 / 临时列表**。
       *
       * 正在播放的歌通常就在试听列表里，把 `allList` 全算进来会导致
       * 「所有歌都显示已收藏」——实测（Android 1206×2622）爱心一开始空心、
       * 读完盘就变实心，明显不对。临时列表同理（放进来只为播放，不是收藏）。
       */
      const listIds = [LIST_IDS.LOVE, ...state.userList.map(l => l.id)]
      for (const listId of listIds) {
        const musics = await getListMusics(listId).catch(() => [] as LX.List.ListMusics)
        if (cancelled) return
        if (musics.some(m => m.id === id)) {
          setIsIn(true)
          return
        }
      }
      if (!cancelled) setIsIn(false)
    }
    void check()
    // 任意列表里的歌曲增删都要重算（含新建/删除歌单）
    const handleMusicUpdate = () => { void check() }
    const handleListUpdate = () => { void check() }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    global.state_event.on('mylistUpdated', handleListUpdate)
    return () => {
      cancelled = true
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
      global.state_event.off('mylistUpdated', handleListUpdate)
    }
  }, [id])

  return isIn
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

