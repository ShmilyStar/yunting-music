import { memo } from 'react'

import Section from '../../components/Section'
import ResourceCache from './ResourceCache'
import MetaCache from './MetaCache'
import DislikeList from './DislikeList'
// import MaxCache from './MaxCache'
import { useI18n } from '@/lang'

/** 其他分组：缓存 / 不喜欢列表（日志已拆成独立分组，见 `Other/Log.tsx`） */
export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_other')}>
      <ResourceCache />
      <MetaCache />
      <DislikeList />
      {/* <MaxCache /> */}
    </Section>
  )
})
