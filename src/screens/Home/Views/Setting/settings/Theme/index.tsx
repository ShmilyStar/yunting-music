import { memo } from 'react'

// import Section from '../../components/Section'
import Theme from './Theme'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
// import { useI18n } from '@/lang/i18n'

/**
 * 主题颜色分组（03 §11）。
 *
 * 标题由 `Theme.tsx` 内的 `SubTitle`（`setting_basic_theme`）提供：
 * 参考实现里这一组不带竖条，与「语言」「字体大小」「分享方式」同级。
 */
export default memo(() => {
  return (
    <>
      <Theme />
      <IsAutoTheme />
      <IsHideBgDark />
      <IsDynamicBg />
      <IsFontShadow />
    </>
  )
})
