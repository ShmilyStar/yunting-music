import { memo } from 'react'

import Section from '../../components/Section'
import IsShowLyric from './IsShowLyric'
import IsLockLyric from './IsLockLyric'
import IsShowToggleAnima from './IsShowToggleAnima'
import IsSingleLine from './IsSingleLine'
import TextSize from './TextSize'
import ViewWidth from './ViewWidth'
import MaxLineNum from './MaxLineNum'
import TextOpacity from './TextOpacity'
import { useI18n } from '@/lang'
import Theme from './Theme'
// import { useTranslation } from '@/plugins/i18n'

/**
 * 桌面歌词设置分组（仅 Android）。
 *
 * 歌词固定居中显示，不再提供水平/垂直对齐设置；窗口位置仍可按拖动后的
 * `desktopLyric.position.x/y` 保存。
 *
 * 悬浮窗会盖住设置页顶部控件、吃掉拖动事件；「不响应触摸」由设置页统一处理
 * （见 `Setting/index.tsx`），这样平板分栏切到其他分组时也不会再挡住控件。
 */
export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_lyric_desktop')}>
      <IsShowLyric />
      <IsLockLyric />
      <IsShowToggleAnima />
      <IsSingleLine />
      <Theme />
      <TextSize />
      <ViewWidth />
      <MaxLineNum />
      <TextOpacity />
    </Section>
  )
})
