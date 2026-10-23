import { memo } from 'react'

import Section from '../../components/Section'
import IsSavePlayTime from './IsSavePlayTime'
import PlayHighQuality from './PlayHighQuality'
import IsHandleAudioFocus from './IsHandleAudioFocus'
import IsEnableAudioOffload from './IsEnableAudioOffload'
import IsAutoCleanPlayedList from './IsAutoCleanPlayedList'
import IsShowBluetoothLyric from './IsShowBluetoothLyric'
import IsShowBluetoothFullLyric from './IsShowBluetoothFullLyric'
import IsShowNotificationImage from './IsShowNotificationImage'
import MaxCache from './MaxCache'
import { useI18n } from '@/lang'
import { isAndroidMediaSessionSupported, isPlayerCacheSupported } from '@/config/platform'

/**
 * 播放器设置分组（03 §11）。
 *
 * 歌词显示相关的三项（翻译 / 罗马音 / 繁化）跟在播放设置之后同组呈现：
 * 「歌词设置」组需要新的 i18n 组标题键（`src/lang/` 不在本次改动范围内），
 * 现有 `setting_play_*` 键都是设置项标签，不能当组标题。
 *
 * 音频焦点、音频卸载、播放器缓存都是 Android 播放器（ExoPlayer）专属能力，
 * iOS 上开关没有任何效果，按能力开关隐藏。
 */
export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_player')}>
      <IsSavePlayTime />
      <IsAutoCleanPlayedList />
      {isAndroidMediaSessionSupported
        ? (
            <>
              <IsHandleAudioFocus />
              <IsEnableAudioOffload />
              {/* 蓝牙歌词 / 完整蓝牙歌词走 Android 媒体会话的 metadata 通道，
                  iOS 侧（锁屏元数据）由锁屏歌词通道承担，这两个开关在 iOS 上是空的 */}
              <IsShowBluetoothLyric />
              <IsShowBluetoothFullLyric />
            </>
          )
        : null}
      <IsShowNotificationImage />
      {isPlayerCacheSupported ? <MaxCache /> : null}
      <PlayHighQuality />
    </Section>
  )
})
