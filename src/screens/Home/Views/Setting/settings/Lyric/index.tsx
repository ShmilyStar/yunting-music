import { memo } from 'react'

import Section from '../../components/Section'
import IsShowLyricTranslation from '../Player/IsShowLyricTranslation'
import IsShowLyricRoma from '../Player/IsShowLyricRoma'
import IsS2T from '../Player/IsS2T'
import { useI18n } from '@/lang'

/** 歌词设置分组（03 §11）：翻译 / 罗马音 / 繁化 */
export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_lyric')}>
      <IsShowLyricTranslation />
      <IsShowLyricRoma />
      <IsS2T />
    </Section>
  )
})
