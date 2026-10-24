import { initSetting, showPactModal } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import { initDownload } from '@/core/download'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import settingState from '@/store/setting/state'
import { bootLog } from '@/utils/bootLog'
import { cheatTip } from '@/utils/tools'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  await cheatTip()
  if (settingState.setting['common.isAgreePact']) {
    if (isFirstPush) {
      isFirstPush = false
      // 不再自动检测更新：只有用户在「设置 → 软件更新」里手动点开才检测
      void initDeeplink()
    }
  } else {
    if (isFirstPush) isFirstPush = false
    showPactModal()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  // 注意：`global.lx.fontSize` 已经在 app.ts 里按持久值赋好，这里**不能再乘一次**
  // （以前这里 `setFontSize(global.lx.fontSize)` 会把 store 里的值也乘上当前值，
  // 于是存 0.8 启动后变成 0.64、再启动继续变小，界面越用越小）。
  bootLog('Font size ready.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initDownload()
  bootLog('Download inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
