import { memo } from 'react'

import Section from '../../components/Section'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import IsHomePageScroll from './IsHomePageScroll'
import IsUseSystemFileSelector from './IsUseSystemFileSelector'
import IsAlwaysKeepStatusbarHeight from './IsAlwaysKeepStatusbarHeight'
import { useI18n } from '@/lang/i18n'

/**
 * 基本设置分组（03 §11）：只保留 5 个开关项。
 * 主题颜色 / 语言 / 字体大小 / 分享方式 / 自定义源已拆成独立分组或次级标题。
 */
export default memo(() => {
  const t = useI18n()


  return (
    <Section title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <IsHomePageScroll />
      <IsUseSystemFileSelector />
      <IsAlwaysKeepStatusbarHeight />
    </Section>
  )
})
