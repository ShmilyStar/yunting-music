import { compareVer } from '@/utils'
import { downloadNewVersion, getVersionInfo } from '@/utils/version'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { getIgnoreVersionFailTipTime, saveIgnoreVersionFailTipTime } from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { Navigation } from 'react-native-navigation'
import { toast } from '@/utils/tools'

export const showModal = () => {
  if (versionState.showModal) return
  versionActions.setVisibleModal(true)
  showVersionModal()
}

export const hideModal = (componentId: string) => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
  void Navigation.dismissOverlay(componentId)
}

/**
 * 检查更新。
 *
 * 只在两个时机触发（用户 2026-10-25 指定）：
 *   1. App 启动时自动检查一次；
 *   2. 用户在「设置 → 软件更新」点「检查更新」。
 * 其余任何界面、任何时机都不再检查（不做定时轮询、不在切前台时重查）。
 *
 * 发现新版本一律弹窗询问，且弹窗不可忽略：点「否」直接退出 App。
 */
export const checkUpdate = async() => {
  versionActions.setVersionInfo({ status: 'checking' })
  let versionInfo: InitState['versionInfo'] = { ...versionState.versionInfo }
  try {
    const { version, desc, history } = await getVersionInfo()
    versionInfo.newVersion = {
      version,
      desc,
      history,
    }
  } catch (err) {
    versionInfo.newVersion = {
      version: '0.0.0',
      desc: '',
      history: [],
    }
  }

  if (versionInfo.newVersion.version == '0.0.0') {
    versionInfo.isUnknown = true
    versionInfo.status = 'error'
  } else {
    versionInfo.status = 'idle'
    versionInfo.isUnknown = false
    // 每次检查都要重算，否则上一次的「已是最新」会粘住不放
    versionInfo.isLatest = compareVer(versionInfo.version, versionInfo.newVersion.version) != -1
  }

  versionActions.setVersionInfo(versionInfo)

  if (versionInfo.isLatest) return

  if (versionInfo.isUnknown) {
    // 拿不到版本信息属于「无法判定」，不做强制更新，只提示
    const time = await getIgnoreVersionFailTipTime()
    if (Date.now() - time < 7 * 86400000) return
    saveIgnoreVersionFailTipTime(Date.now())
    toast(global.i18n.t('version_tip_unknown'))
    return
  }

  // 有新版本：弹窗，用户必须选择（点「否」即退出 App）
  showModal()
}

/**
 * 下载新版本（Android 下载完成后由 `downloadNewVersion` 自动拉起系统安装界面）。
 *
 * 流程：发现新版本 → 弹窗「是」→ 后台下载 → 自动弹安装器，
 * 「安装」最后一步由用户在系统界面手动确认。
 */
export const downloadUpdate = () => {
  const targetVer = versionState.versionInfo.newVersion?.version
  // 没有版本号就退回 idle，否则会带着 undefined 去拼下载地址
  if (!targetVer) {
    versionActions.setVersionInfo({ status: 'idle' })
    return
  }
  versionActions.setVersionInfo({ status: 'downloading' })
  versionActions.setProgress({ total: 0, current: 0 })

  downloadNewVersion(targetVer, (total: number, current: number) => {
    versionActions.setProgress({ total, current })
  }).then(() => {
    versionActions.setVersionInfo({ status: 'downloaded' })
  }).catch(() => {
    versionActions.setVersionInfo({ status: 'error' })
  })
}
