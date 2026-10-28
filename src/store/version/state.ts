import { version as pkgVersion } from '../../../package.json'
import { getVersionName } from '@/utils/nativeModules/utils'

/**
 * 本机版本号。
 *
 * 优先用原生返回的 versionName（= APK 真实版本）；只有拿不到时才退回
 * 打包进 bundle 的 package.json。原因见 UtilsModule.getVersionName 的注释：
 * 改 package.json 不会触发 JS bundle 重新打包，旧 bundle 会让「装完新版还提示更新」。
 */
const version = getVersionName() ?? pkgVersion

export interface ProgressInfo {
  total: number
  current: number
}

export interface VersionInfo {
  version: string
  desc: string
  history?: LX.VersionInfo[]
}

export interface InitState {
  showModal: boolean
  versionInfo: {
    version: string
    newVersion: VersionInfo | null
    showModal: boolean
    isUnknown: boolean
    isLatest: boolean
    reCheck: boolean
    status: LX.UpdateStatus
  }
  ignoreVersion: string | null
  progress: ProgressInfo
}

const state: InitState = {
  showModal: false,
  versionInfo: {
    version,
    newVersion: null,
    showModal: false,
    reCheck: false,
    isUnknown: false,
    isLatest: false,
    /**
     * 初始必须是 idle。
     *
     * 之前这里是 'checking'，但没有任何地方在启动时真的发起检查，设置页
     * 一进来就永久显示「检查更新中」，按钮也被 isChecking 禁用。
     */
    status: 'idle',
  },
  ignoreVersion: null,
  progress: {
    total: 0,
    current: 0,
  },
}


export default state
