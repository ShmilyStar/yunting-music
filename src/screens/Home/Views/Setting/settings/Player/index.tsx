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

/**
 * 播放器设置分组（03 §11）。
 *
 * 歌词显示相关的三项（翻译 / 罗马音 / 繁化）跟在播放设置之后同组呈现：
 * 「歌词设置」组需要新的 i18n 组标题键（`src/lang/` 不在本次改动范围内），
 * 现有 `setting_play_*` 键都是设置项标签，不能当组标题。
 */
export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_player')}>
      <IsSavePlayTime />
      <IsAutoCleanPlayedList />
      <IsHandleAudioFocus />
      <IsEnableAudioOffload />
      <IsShowBluetoothLyric />
      <IsShowBluetoothFullLyric />
      <IsShowNotificationImage />
      <MaxCache />
      <PlayHighQuality />
    </Section>
  )
})
