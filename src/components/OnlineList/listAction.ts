import { LIST_IDS } from '@/config/constant'
import { addListMusics, removeListMusics } from '@/core/list'
import { playList, playNext } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { getListMusicSync } from '@/utils/listManage'
import { confirmDialog, openUrl, toast } from '@/utils/tools'
import { addDislikeInfo, hasDislike } from '@/core/dislikeList'
import playerState from '@/store/player/state'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import { clearMusicUrlByMusic } from '@/utils/data'

/**
 * 收藏 / 取消收藏一首歌（歌单、榜单等在线列表的菜单项）。
 *
 * 不走 `core/player` 的 `collectMusic`：那个只作用于「当前播放」的歌曲，
 * 而这里要处理列表里任意一首。
 */
export const handleCollectMusic = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const isLoved = getListMusicSync(LIST_IDS.LOVE).some(m => m.id == musicInfo.id)
  if (isLoved) {
    await removeListMusics(LIST_IDS.LOVE, [musicInfo.id])
    toast(global.i18n.t('uncollect'))
  } else {
    await addListMusics(LIST_IDS.LOVE, [musicInfo], settingState.setting['list.addMusicLocationType'])
    toast(global.i18n.t('collect'))
  }
}

export const handlePlay = (musicInfo: LX.Music.MusicInfoOnline) => {
  void addListMusics(LIST_IDS.DEFAULT, [musicInfo], settingState.setting['list.addMusicLocationType']).then(() => {
    const index = getListMusicSync(LIST_IDS.DEFAULT).findIndex(m => m.id == musicInfo.id)
    if (index < 0) return
    void playList(LIST_IDS.DEFAULT, index)
  })
}
export const handlePlayLater = (musicInfo: LX.Music.MusicInfoOnline, selectedList: LX.Music.MusicInfoOnline[], onCancelSelect: () => void) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map(s => ({ listId: '', musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId: '', musicInfo }])
  }
}


export const handleShowMusicSourceDetail = async(minfo: LX.Music.MusicInfoOnline) => {
  const url = musicSdk[minfo.source as LX.OnlineSource]?.getMusicDetailPageUrl(toOldMusicInfo(minfo))
  if (!url) return
  void openUrl(url)
}

export const clearMusicUrl = async(musicInfo: LX.Music.MusicInfoOnline) => {
  try {
    await clearMusicUrlByMusic(musicInfo)
  } catch (error) {
    toast(global.i18n.t('list_remove_cache_fail_tip', { msg: (error as Error).message }))
    return
  }
  toast(global.i18n.t('list_remove_cache_success_tip'))
}

export const handleDislikeMusic = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const confirm = await confirmDialog({
    message: musicInfo.singer ? global.i18n.t('lists_dislike_music_singer_tip', { name: musicInfo.name, singer: musicInfo.singer }) : global.i18n.t('lists_dislike_music_tip', { name: musicInfo.name }),
    cancelButtonText: global.i18n.t('cancel_button_text_2'),
    confirmButtonText: global.i18n.t('confirm_button_text'),
    bgClose: false,
  })
  if (!confirm) return
  await addDislikeInfo([{ name: musicInfo.name, singer: musicInfo.singer }])
  toast(global.i18n.t('lists_dislike_music_add_tip'))
  if (hasDislike(playerState.playMusicInfo.musicInfo)) {
    void playNext(true)
  }
}

