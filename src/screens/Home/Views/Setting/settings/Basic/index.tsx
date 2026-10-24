import { memo } from 'react'

import Section from '../../components/Section'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import IsUseSystemFileSelector from './IsUseSystemFileSelector'
import IsAlwaysKeepStatusbarHeight from './IsAlwaysKeepStatusbarHeight'
import { useI18n } from '@/lang/i18n'

/**
 * 基本设置分组（03 §11）：只保留开关项。
 * 主题颜色 / 语言 / 字体大小 / 自定义源已拆成独立分组或次级标题。
 * 「竖屏首页横向滚动」随「发现↔我的 滑动切换」一并取消，开关已移除。
 */
export default memo(() => {
  const t = useI18n()


  return (
    <Section title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <IsUseSystemFileSelector />
      <IsAlwaysKeepStatusbarHeight />
    </Section>
  )
})
