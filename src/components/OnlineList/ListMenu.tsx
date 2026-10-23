import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import Menu, { type Menus, type MenuType, type Position } from '@/components/common/Menu'
import { isDownloadSupported } from '@/core/download'
import { useSettingValue } from '@/store/setting/hook'
import { hasMusicUrlByMusic } from '@/utils/data'
import { getListMusicSync } from '@/utils/listManage'
import { LIST_IDS } from '@/config/constant'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
}
const initSelectInfo = {}

const hasUrlCache = async(musicInfo: LX.Music.MusicInfo) => {
  return hasMusicUrlByMusic(musicInfo)
}
export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  /** 收藏 / 取消收藏（按该歌曲当前是否在收藏列表切换） */
  onCollect: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>((props: ListMenuProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<MenuType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<Menus>([])
  // §10.2：下载项显示条件 = 平台支持 ∧ 功能开启 ∧ 非本地歌曲（本地歌曲在在线列表不出现，此处恒成立）
  const downloadEnable = useSettingValue('download.enable')
  const showDownload = isDownloadSupported() && downloadEnable

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
    let has_url_cache = false
    // 按用户要求：去掉「播放」「稍后播放」「分享歌曲」「不喜欢」；
    // 点击行本身即可播放，菜单只保留收藏 / 下载 / 添加 / 清缓存
    const isLoved = getListMusicSync(LIST_IDS.LOVE).some(m => m.id == musicInfo.id)
    const menu = [
      { action: 'collect', label: t(isLoved ? 'uncollect' : 'collect') },
      { action: 'add', label: t('add_to') },
      { action: 'removeCache', disabled: !has_url_cache, label: t('list_remove_cache') },
    ]
    // 下载项插在「收藏」之后，仅在支持且开启时出现
    if (showDownload) menu.splice(1, 0, { action: 'download', label: t('download') })
    setMenus(menu)
    void hasUrlCache(musicInfo).then((_has_url_cache) => {
      let isUpdated = false
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
      case 'collect':
        props.onCollect(selectInfo)
        break
      case 'download':
        props.onDownload(selectInfo)
        break
      case 'add':
        props.onAdd(selectInfo)
        break
      // 播放 / 歌曲详情 / 稍后播放 / 分享 / 不喜欢 入口均已移除（见 handleSetMenu）
      case 'removeCache':
        props.onRemoveCache(selectInfo)
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
