import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import Menu, { type Menus, type MenuType, type Position } from '@/components/common/Menu'
import { hasDislike } from '@/core/dislikeList'
import { existsFile } from '@/utils/fs'
import { isDownloadSupported } from '@/core/download'
import { isAudioMetadataWriteSupported } from '@/config/platform'
import settingState from '@/store/setting/state'
import { hasMusicUrlByMusic } from '@/utils/data'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
  selectedList: LX.Music.MusicInfo[]
  index: number
  listId: string
  single: boolean
}
const initSelectInfo = {}

export interface ListMenuProps {
  onDownload: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onEditMetadata: (selectInfo: SelectInfo) => void
  onToggleSource: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
  onRemove: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

const hasEditMetadata = async(musicInfo: LX.Music.MusicInfo) => {
  if (musicInfo.source != 'local') return false
  return existsFile(musicInfo.meta.filePath)
}
const hasUrlCache = async(musicInfo: LX.Music.MusicInfo) => {
  return hasMusicUrlByMusic(musicInfo)
}
export default forwardRef<ListMenuType, ListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<MenuType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<Menus>([])

  useImperativeHandle(ref, () => ({
    show(selectInfo, position) {
      selectInfoRef.current = selectInfo
      handleSetMenu(selectInfo.musicInfo)
      if (visible) menuRef.current?.show(position)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show(position)
        })
      }
    },
  }))

  const handleSetMenu = (musicInfo: LX.Music.MusicInfo) => {
    let edit_metadata = false
    let has_url_cache = false
    const isLocal = musicInfo.source == 'local'
    // 按用户要求：去掉「播放」「稍后播放」「移动到」「调整位置」「分享歌曲」；
    // 点击行 itself 即可播放，移动 / 排序在别处有入口
    const menu = [
      { action: 'add', label: t('add_to') },
      { action: 'toggleSource', label: t('toggle_source') },
      { action: 'removeCache', disabled: !has_url_cache, label: t('list_remove_cache') },
      { action: 'dislike', disabled: hasDislike(musicInfo), label: t('dislike') },
      { action: 'remove', label: t('delete') },
    ]
    // 写标签只有 Android 原生支持（iOS 侧 writeMetadata 直接 reject），
    // 能力不支持时整项不出现，避免点了只弹一个失败提示
    if (isLocal && isAudioMetadataWriteSupported) menu.splice(1, 0, { action: 'editMetadata', disabled: !edit_metadata, label: t('edit_metadata') })
    // §10.2：下载项 = 平台支持 ∧ 功能开启 ∧ 非本地歌曲
    if (isDownloadSupported() && settingState.setting['download.enable'] && !isLocal) {
      menu.unshift({ action: 'download', label: t('download') })
    }
    setMenus(menu)
    void Promise.all([isLocal ? hasEditMetadata(musicInfo) : Promise.resolve(false), hasUrlCache(musicInfo)]).then(([_edit_metadata, _has_url_cache]) => {
      let isUpdated = false
      if (edit_metadata != _edit_metadata) {
        edit_metadata = _edit_metadata
        menu[menu.findIndex(m => m.action == 'editMetadata')].disabled = !edit_metadata
        isUpdated ||= true
      }
      if (has_url_cache != _has_url_cache) {
        has_url_cache = _has_url_cache
        menu[menu.findIndex(m => m.action == 'removeCache')].disabled = !has_url_cache
        isUpdated ||= true
      }

      if (isUpdated) setMenus([...menu])
    })
  }

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'download':
        props.onDownload(selectInfo)
        break
      case 'add':
        props.onAdd(selectInfo)
        break
      case 'editMetadata':
        props.onEditMetadata(selectInfo)
        break
      case 'toggleSource':
        props.onToggleSource(selectInfo)
        break
      case 'removeCache':
        props.onRemoveCache(selectInfo)
        break
      case 'dislike':
        props.onDislikeMusic(selectInfo)
        break
      case 'remove':
        props.onRemove(selectInfo)
        break
      default:
        break
    }
  }

  return (
    visible
      ? <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} />
      : null
  )
})
