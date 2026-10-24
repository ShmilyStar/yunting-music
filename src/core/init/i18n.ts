import { createI18n } from '@/lang/i18n'
import type { I18n } from '@/lang/i18n'
import { getDeviceLanguage } from '@/utils/tools'
import { setLanguage, updateSetting } from '@/core/common'
import { Platform } from 'react-native'

/**
 * iOS 端固定使用简体中文（用户 2026-10-21 要求）。
 *
 * 原因：iOS 版只面向中文用户发布，跟随系统语言会因设备区域/语言设置不同而
 * 落到 zh_tw 或 en_us，同一份包在不同手机上显示不一致。
 *
 * 注意这里只约束**默认值**：用户在「设置 → 语言」里主动选过别的语言时，
 * `common.langId` 已有值，仍会尊重用户选择（见下方逻辑）。
 */
const IOS_FORCED_LOCALE: I18n['locale'] = 'zh_cn'

export default async(setting: LX.AppSetting) => {
  let lang = setting['common.langId']

  global.i18n = createI18n()

  // iOS：未显式选过语言时，直接固定为简体中文，不去读设备语言
  if (Platform.OS === 'ios' && !lang) {
    updateSetting({ 'common.langId': IOS_FORCED_LOCALE })
    setLanguage(IOS_FORCED_LOCALE)
    return
  }

  if (!lang || !global.i18n.availableLocales.includes(lang)) {
    // 设备语言形如 `zh-hans-cn` / `zh_CN` / `en-US`，而 availableLocales 是
    // `zh_cn` / `zh_tw` / `en_us`：先归一化（小写 + `-`→`_`）再匹配，
    // 只取语言+地区两段，否则中文设备会一路落到 en_us
    const raw = (await getDeviceLanguage()).toLowerCase().replace(/-/g, '_')
    const candidates = [raw, raw.split('_').slice(0, 2).join('_'), raw.split('_')[0]]
    const matched = candidates.find(item => global.i18n.availableLocales.includes(item as I18n['locale']))
    if (matched) {
      lang = matched as I18n['locale']
    } else {
      lang = Platform.OS === 'ios' ? IOS_FORCED_LOCALE : 'en_us'
    }
    updateSetting({ 'common.langId': lang })
  }
  setLanguage(lang)
}
