import { memo, useCallback, useMemo, useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import IconMC from '@/components/common/IconMC'
import Text from '@/components/common/Text'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import DownloadModal, { type DownloadModalType } from '@/components/DownloadModal'
import SettingPopup, { type SettingPopupType } from '@/screens/PlayDetail/components/SettingPopup'
import { useI18n } from '@/lang'
import { toast, createStyle } from '@/utils/tools'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST, LIST_IDS } from '@/config/constant'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import playerState from '@/store/player/state'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useMusicInAnyList } from '@/store/list/hook'
import { removeMusicFromFavoriteLists } from '@/core/list'
import { useDownloadList } from '@/store/download/hook'
import { showPlayListPopup, togglePlayListPopup } from '@/core/playListPopup'

export type ActionIconType = 'icomoon' | 'mc'

/** 同一个语义在两套图标集里的字形名 */
export const ICON_NAME = {
  love: { icomoon: 'love', mc: 'heart' },
  loveOutline: { icomoon: 'love', mc: 'heart-outline' },
  download: { icomoon: 'download-2', mc: 'download-outline' },
  musicAdd: { icomoon: 'add-music', mc: 'playlist-plus' },
  share: { icomoon: 'share', mc: 'swap-horizontal' },
  lyricOn: { icomoon: 'lyric-on', mc: 'subtitles' },
  lyricOff: { icomoon: 'lyric-off', mc: 'subtitles-outline' },
  listLoop: { icomoon: 'list-loop', mc: 'repeat' },
  listRandom: { icomoon: 'list-random', mc: 'shuffle' },
  listOrder: { icomoon: 'list-order', mc: 'arrow-right' },
  singleLoop: { icomoon: 'single-loop', mc: 'repeat-once' },
  single: { icomoon: 'single', mc: 'numeric-1-box-outline' },
  playlist: { icomoon: 'menu', mc: 'playlist-play' },
  setting: { icomoon: 'slider', mc: 'cog-outline' },
} as const

export type ActionIconName = keyof typeof ICON_NAME

export const ActionIcon = ({ name, iconType, size, color }: {
  name: ActionIconName
  iconType: ActionIconType
  size: number
  color?: string
}) => {
  const pair = ICON_NAME[name]
  return iconType === 'mc'
    ? <IconMC name={pair.mc} size={size} color={color} />
    : <Icon name={pair.icomoon} size={size} color={color} />
}

/** 当前播放歌曲的「纯净」musicInfo（下载项要取元数据里的那层） */
export const getCurrentMusicInfo = (): LX.Music.MusicInfo | null => {
  const info = playerState.playMusicInfo.musicInfo
  if (!info) return null
  return 'progress' in info ? info.metadata.musicInfo : info
}

export const ActionBtn = ({ onPress, children }: {
  onPress: () => void
  children: React.ReactNode
}) => (
  <TouchableOpacity style={styles.btn} activeOpacity={0.5} onPress={onPress}>
    {children}
  </TouchableOpacity>
)

/**
 * 下载：打开统一的下载音质弹窗，任务由 `core/download` 的队列创建。
 *
 * 旧实现直接调用 `core/music/downloadFile` 的 `downloadMusic` 一次性下载，
 * 不经过任务队列，因此在「已下载」列表里没有任何记录，与列表行菜单的下载不一致。
 * 图标位置保留百分比进度：取当前播放歌曲在下载列表里的任务进度。
 */
export const DownloadBtn = memo(({ iconType, size, color }: {
  iconType: ActionIconType
  size: number
  color?: string
}) => {
  const t = useI18n()
  const downloadModalRef = useRef<DownloadModalType>(null)
  const downloadList = useDownloadList()
  const playMusicInfo = usePlayMusicInfo()

  const progress = useMemo(() => {
    const info = playMusicInfo.musicInfo
    if (!info) return null
    // 播放中的条目可能是「带 progress 的播放态」，下载项要取元数据里的那层
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    const task = downloadList.find(t => t.metadata.musicInfo.id == musicInfo.id)
    if (!task) return null
    return task.status === 'run' || task.status === 'waiting' || task.status === 'pause'
      ? task.progress
      : null
  }, [downloadList, playMusicInfo])

  const handleDownload = useCallback(() => {
    const musicInfo = getCurrentMusicInfo()
    if (!musicInfo) return
    // 本地歌曲没有可下载的在线源
    if (musicInfo.source === 'local') {
      toast(t('play_download_unsupported'))
      return
    }
    downloadModalRef.current?.show({ musicInfo, selectedList: [musicInfo] })
  }, [t])

  return (
    <>
      <ActionBtn onPress={handleDownload}>
        {progress == null
          ? <ActionIcon name="download" iconType={iconType} size={size} color={color} />
          : <Text size={size * 0.55} color={color}>{Math.round(progress)}%</Text>}
      </ActionBtn>
      <DownloadModal ref={downloadModalRef} />
    </>
  )
})

/** 添加到列表（+ 图标） */
export const MusicAddBtn = memo(({ iconType, size, color }: {
  iconType: ActionIconType
  size: number
  color?: string
}) => {
  const musicAddModalRef = useRef<MusicAddModalType>(null)

  const handleShow = useCallback(() => {
    const musicInfo = getCurrentMusicInfo()
    if (!musicInfo) return
    musicAddModalRef.current?.show({
      musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId ?? LIST_IDS.TEMP,
    })
  }, [])

  return (
    <>
      <ActionBtn onPress={handleShow}>
        <ActionIcon name="musicAdd" iconType={iconType} size={size} color={color} />
      </ActionBtn>
      <MusicAddModal ref={musicAddModalRef} />
    </>
  )
})

/**
 * 收藏爱心（**空心 / 实心**）：mini 条与主播放页共用同一套外观与逻辑。
 *
 * 用户 2026-10-21 的要求：
 * - mini 条的「收藏」改成「添加到歌单」，**图标不变**（仍是爱心）；
 * - 主播放页（进度条上方）那颗也换成与 mini 条完全一样的爱心；
 * - 只要歌曲被收藏过（不论收藏到哪个歌单，含「我的收藏」），空心就变实心。
 *
 * 用户 2026-10-22 补充的交互（**必须成对**）：
 * - 空心点击 → 弹出「添加到歌单」弹窗，选完任一歌单后变实心；
 * - 实心点击 → 直接取消收藏（从所有已收藏的列表里移除），变回空心。
 *
 * 图标强制用 mc 的 `heart-outline` / `heart`：
 * icomoon 字体里只有一颗 `love`（实心），拿它做「空心」永远是实心，
 * 这也是主播放页爱心状态一直不对的根因。
 */
export const MusicAddHeartBtn = memo(({ size, color, activeColor }: {
  /** @deprecated 图标固定用 mc 心形，仅为兼容旧调用点保留 */
  iconType?: ActionIconType
  size: number
  color?: string
  activeColor?: string
}) => {
  const t = useI18n()
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  // 换歌时父级 props 不变，必须自己订阅播放信息，否则爱心会停在上一首的状态
  const playMusicInfo = usePlayMusicInfo()
  const musicInfo = useMemo(() => {
    const info = playMusicInfo.musicInfo
    if (!info) return null
    return 'progress' in info ? info.metadata.musicInfo : info
  }, [playMusicInfo])
  const isInAnyList = useMusicInAnyList(musicInfo)

  const handlePress = useCallback(() => {
    const musicInfo = getCurrentMusicInfo()
    if (!musicInfo) return
    if (isInAnyList) {
      void removeMusicFromFavoriteLists(musicInfo.id).then((removed) => {
        // 理论上一定非空（爱心是实心说明至少在一个列表里），空数组就当没发生
        if (!removed.length) return
        toast(t('uncollect'))
      })
      return
    }
    musicAddModalRef.current?.show({
      musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId ?? LIST_IDS.TEMP,
    })
  }, [isInAnyList, t])

  return (
    <>
      <ActionBtn onPress={handlePress}>
        <ActionIcon
          name={isInAnyList ? 'love' : 'loveOutline'}
          iconType="mc"
          size={size}
          color={isInAnyList ? (activeColor ?? color) : color}
        />
      </ActionBtn>
      <MusicAddModal ref={musicAddModalRef} />
    </>
  )
})

/** 播放器设置（二级菜单，桌面歌词开关也在里面） */
export const PlayerSettingBtn = memo(({ iconType, size, color, direction, position }: {
  iconType: ActionIconType
  size: number
  color?: string
  direction: 'vertical' | 'horizontal'
  position?: 'left' | 'right'
}) => {
  const popupRef = useRef<SettingPopupType>(null)

  return (
    <>
      <ActionBtn onPress={() => { popupRef.current?.show() }}>
        <ActionIcon name="setting" iconType={iconType} size={size} color={color} />
      </ActionBtn>
      <SettingPopup ref={popupRef} direction={direction} position={position} />
    </>
  )
})

/** 播放模式（图标由设置值派生，单一数据源） */
export const PlayModeBtn = memo(({ iconType, size, color }: {
  iconType: ActionIconType
  size: number
  color?: string
}) => {
  const t = useI18n()
  // 用 hook 订阅设置，切模式后图标与状态同步刷新（单一数据源）
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')

  const handleToggle = useCallback(() => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    let modeName: 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'
    switch (mode) {
      case MUSIC_TOGGLE_MODE.listLoop: modeName = 'play_list_loop'; break
      case MUSIC_TOGGLE_MODE.random: modeName = 'play_list_random'; break
      case MUSIC_TOGGLE_MODE.list: modeName = 'play_list_order'; break
      case MUSIC_TOGGLE_MODE.singleLoop: modeName = 'play_single_loop'; break
      default: modeName = 'play_single'; break
    }
    toast(t(modeName))
  }, [togglePlayMethod, t])

  const iconName = useMemo<ActionIconName>(() => {
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.random: return 'listRandom'
      case MUSIC_TOGGLE_MODE.list: return 'listOrder'
      case MUSIC_TOGGLE_MODE.singleLoop: return 'singleLoop'
      case MUSIC_TOGGLE_MODE.none: return 'single'
      default: return 'listLoop'
    }
  }, [togglePlayMethod])

  return (
    <ActionBtn onPress={handleToggle}>
      <ActionIcon name={iconName} iconType={iconType} size={size} color={color} />
    </ActionBtn>
  )
})

/** 播放列表：`toggle` 走开/关切换（mini 条用），否则只负责呼出（播放页用） */
export const PlayListBtn = memo(({ iconType, size, color, toggle = false }: {
  iconType: ActionIconType
  size: number
  color?: string
  toggle?: boolean
}) => (
  <ActionBtn onPress={toggle ? togglePlayListPopup : showPlayListPopup}>
    <ActionIcon name="playlist" iconType={iconType} size={size} color={color} />
  </ActionBtn>
))

const styles = createStyle({
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
