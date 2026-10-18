import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import IconMC from '@/components/common/IconMC'
import Text from '@/components/common/Text'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import SettingPopup, { type SettingPopupType } from '@/screens/PlayDetail/components/SettingPopup'
import { useI18n } from '@/lang'
import { shareMusic, toast, createStyle } from '@/utils/tools'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST, LIST_IDS } from '@/config/constant'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { useSettingValue } from '@/store/setting/hook'
import playerState from '@/store/player/state'
import { useMusicInLoveList } from '@/store/list/hook'
import { collectMusic, uncollectMusic } from '@/core/player/player'
import { showPlayListPopup, togglePlayListPopup } from '@/core/playListPopup'
import { downloadMusic } from '@/core/music/downloadFile'

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

/** 收藏 / 取消收藏 */
export const LoveBtn = memo(({ iconType, size, color, activeColor }: {
  iconType: ActionIconType
  size: number
  color?: string
  activeColor?: string
}) => {
  const musicInfo = getCurrentMusicInfo()
  const isLoved = useMusicInLoveList(musicInfo)

  const handleToggle = useCallback(() => {
    if (isLoved) uncollectMusic()
    else collectMusic()
  }, [isLoved])

  return (
    <ActionBtn onPress={handleToggle}>
      <ActionIcon
        name={isLoved ? 'love' : 'loveOutline'}
        iconType={iconType}
        size={size}
        color={isLoved ? (activeColor ?? color) : color}
      />
    </ActionBtn>
  )
})

/** 下载（图标位置显示百分比进度） */
export const DownloadBtn = memo(({ iconType, size, color }: {
  iconType: ActionIconType
  size: number
  color?: string
}) => {
  const t = useI18n()
  const [progress, setProgress] = useState<number | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDownload = useCallback(() => {
    const musicInfo = getCurrentMusicInfo()
    if (!musicInfo) return
    if (progress != null) return
    setProgress(0)
    void downloadMusic({ musicInfo, onProgress: setProgress })
      .then((path) => {
        toast(t('play_download_success', { path }), 'long')
      })
      .catch((err: Error) => {
        toast(t(err?.message === 'DOWNLOAD_UNSUPPORTED_SOURCE' ? 'play_download_unsupported' : 'play_download_failed'))
      })
      .finally(() => {
        if (resetTimer.current) clearTimeout(resetTimer.current)
        resetTimer.current = setTimeout(() => { setProgress(null) }, 1200)
      })
  }, [progress, t])

  return (
    <ActionBtn onPress={handleDownload}>
      {progress == null
        ? <ActionIcon name="download" iconType={iconType} size={size} color={color} />
        : <Text size={size * 0.55} color={color}>{Math.round(progress * 100)}%</Text>}
    </ActionBtn>
  )
})

/** 添加到列表 */
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

/** 分享 */
export const ShareBtn = memo(({ iconType, size, color }: {
  iconType: ActionIconType
  size: number
  color?: string
}) => {
  const handleShare = useCallback(() => {
    const musicInfo = getCurrentMusicInfo()
    if (!musicInfo) return
    shareMusic(settingState.setting['common.shareType'], settingState.setting['download.fileName'], musicInfo)
  }, [])

  return (
    <ActionBtn onPress={handleShare}>
      <ActionIcon name="share" iconType={iconType} size={size} color={color} />
    </ActionBtn>
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
