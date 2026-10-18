import { getData, removeData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import recentPlayState from '@/store/recentPlay/state'
import recentPlayActions from '@/store/recentPlay/action'

/** 持久化键：`@recent_play` */
const storageKey = storageDataPrefix.recentPlay

/** 最多保留的条数（按最近播放降序截断） */
const MAX_COUNT = 100

let loaded = false

/**
 * 首次读盘（幂等）。
 *
 * 记录与清空都会先 `await` 它，保证「读盘」不会晚于「写入」落地
 * ——否则冷启动后第一次播放的写入会被随后完成的读盘覆盖。
 */
export const initRecentPlay = async() => {
  if (loaded) return
  loaded = true
  const list = await getData<LX.Music.MusicInfoOnline[]>(storageKey) ?? []
  recentPlayActions.setRecentList(list)
}

/** 读取当前最近播放列表（内存快照，最近播放的在最前） */
export const getRecentPlay = (): LX.Music.MusicInfoOnline[] => [...recentPlayState.recentList]

/**
 * 记录一次播放。
 *
 * 本地歌曲没有可复用的在线歌曲信息（最近播放页点歌要把列表写进临时列表），
 * 直接忽略；下载任务项取其元数据里的在线歌曲信息。
 */
export const addRecentPlay = (musicInfo: LX.Player.PlayMusic) => {
  const info = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  if (info.source == 'local') return
  const onlineInfo: LX.Music.MusicInfoOnline = info

  void initRecentPlay().catch((err: unknown) => {
    // 读盘失败不阻断记录：退化为「只有本次会话的记录」
    console.log(err)
  }).then(() => {
    // 同一首歌再次播放时提到最前，而不是留下重复项
    const list = [onlineInfo, ...recentPlayState.recentList.filter(item => item.id !== onlineInfo.id)]
    if (list.length > MAX_COUNT) list.length = MAX_COUNT
    recentPlayActions.setRecentList(list)
    void saveData(storageKey, list)
  })
}

/** 清空最近播放（内存 + 持久化） */
export const clearRecentPlay = async() => {
  await initRecentPlay().catch((err: unknown) => {
    console.log(err)
  })
  recentPlayActions.setRecentList([])
  await removeData(storageKey)
}

/**
 * 按关键字过滤（歌名 / 歌手 / 专辑名任意匹配，忽略大小写）。
 * 关键字为空时返回原列表的副本。
 */
export const searchRecentPlay = (keyword: string, list = recentPlayState.recentList): LX.Music.MusicInfoOnline[] => {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return [...list]
  return list.filter(item =>
    item.name.toLowerCase().includes(kw) ||
    item.singer.toLowerCase().includes(kw) ||
    (item.meta.albumName ?? '').toLowerCase().includes(kw),
  )
}
