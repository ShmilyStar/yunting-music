import { init as initLyricPlayer, toggleTranslation, toggleRoma, play, pause, stop, setLyric, setPlaybackRate, handleSeek, handleProgress } from '@/core/lyric'
import { updateSetting } from '@/core/common'
import { onDesktopLyricPositionChange, showDesktopLyric, onLyricLinePlay, showRemoteLyric, onDesktopLyricAction, hideDesktopLyric, setDesktopLyricMaxLineNum } from '@/core/desktopLyric'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import playerState from '@/store/player/state'
import { updateNowPlayingTitles } from '@/plugins/player/utils'
import { setLastLyric } from '@/core/player/playInfo'

const updateRemoteLyric = async(lrc?: string) => {
  setLastLyric(lrc)
  if (lrc == null) {
    void updateNowPlayingTitles({
      title: playerState.musicInfo.name,
      artist: playerState.musicInfo.singer ?? '',
      album: playerState.musicInfo.album ?? '',
    })
  } else {
    void updateNowPlayingTitles({
      title: lrc,
      artist: `${playerState.musicInfo.name}${playerState.musicInfo.singer ? ` - ${playerState.musicInfo.singer}` : ''}`,
      album: playerState.musicInfo.album ?? '',
    })
  }
}

export default async(setting: LX.AppSetting) => {
  await initLyricPlayer()
  await Promise.all([
    setPlaybackRate(setting['player.playbackRate']),
    toggleTranslation(setting['player.isShowLyricTranslation']),
    toggleRoma(setting['player.isShowLyricRoma']),
  ])

  if (setting['desktopLyric.enable']) {
    showDesktopLyric().catch((err) => {
      console.warn('showDesktopLyric failed', err)
      updateSetting({ 'desktopLyric.enable': false })
    })
  }
  if (setting['player.isShowBluetoothLyric']) {
    showRemoteLyric(true).catch(() => {
      updateSetting({ 'player.isShowBluetoothLyric': false })
    })
  }
  onDesktopLyricPositionChange(position => {
    updateSetting({
      'desktopLyric.position.x': position.x,
      'desktopLyric.position.y': position.y,
    })
  })
  onLyricLinePlay(({ text, extendedLyrics }) => {
    if (!text && !playerState.isPlay) {
      void updateRemoteLyric()
    } else {
      void updateRemoteLyric(text)
    }
  })
  // 桌面歌词悬浮窗上的控制按钮：原生只负责画和发事件，播放动作与设置落库在这里
  onDesktopLyricAction(({ action, value, shadow }) => {
    switch (action) {
      case 'prev':
        void playPrev()
        break
      case 'next':
        void playNext()
        break
      case 'toggle':
        togglePlay()
        break
      case 'close':
        void hideDesktopLyric()
        updateSetting({ 'desktopLyric.enable': false })
        break
      case 'lock':
        updateSetting({ 'desktopLyric.isLock': true })
        break
      case 'theme':
        if (value) {
          updateSetting({
            'desktopLyric.style.lyricPlayedColor': value,
            ...(shadow ? { 'desktopLyric.style.lyricShadowColor': shadow } : {}),
          })
        }
        break
      case 'fontSize': {
        const size = Number(value)
        if (Number.isFinite(size)) updateSetting({ 'desktopLyric.style.fontSize': size })
        break
      }
      case 'maxLineNum': {
        const lineNum = Number(value)
        if (Number.isFinite(lineNum)) {
          const next = Math.max(1, Math.min(8, Math.round(lineNum)))
          void setDesktopLyricMaxLineNum(next).then(() => {
            updateSetting({ 'desktopLyric.maxLineNum': next })
          })
        }
        break
      }
      case 'width': {
        const width = Number(value)
        if (Number.isFinite(width)) updateSetting({ 'desktopLyric.width': Math.max(10, Math.min(100, Math.round(width))) })
        break
      }
    }
  })


  global.app_event.on('play', play)
  global.app_event.on('pause', pause)
  global.app_event.on('stop', stop)
  global.app_event.on('error', pause)
  global.app_event.on('musicToggled', stop)
  global.app_event.on('lyricUpdated', setLyric)
  // seek / 进度刷新不派发 play、pause 事件（原生 seekTo 是静默的），
  // 歌词必须显式订阅这两条链路，否则拖动进度条、点歌词行跳转之后
  // 当前行永远停在 seek 之前的那一句（用户反馈 2026-10-24）
  global.app_event.on('setProgress', handleSeek)
  global.app_event.on('progress', handleProgress)
}
