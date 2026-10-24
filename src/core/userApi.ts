import { action, state } from '@/store/userApi'
import {
  addUserApi,
  getUserApiScript,
  removeUserApi as removeUserApiFromStore,
  setUserApiAllowShowUpdateAlert as setUserApiAllowShowUpdateAlertFromStore,
  updateUserApiScript,
} from '@/utils/data'
import { destroy, loadScript } from '@/utils/nativeModules/userApi'
import { log as writeLog } from '@/utils/log'
import { httpFetch } from '@/utils/request'

/** 脚本过大直接拒绝（和「在线导入」的上限保持一致） */
const MAX_SCRIPT_SIZE = 9_000_000

/** 下载脚本文本（带体积与「是不是音源脚本」校验） */
export const fetchUserApiScript = async(url: string): Promise<string> => {
  const script = await httpFetch(url).promise.then(resp => String(resp.body ?? ''))
  if (!script.length) throw new Error('empty script')
  if (script.length > MAX_SCRIPT_SIZE) throw new Error('script too large')
  // 音源脚本必须有头部注释块（`addUserApi` 也按这个判定合法性）
  if (!/^\/\*[\S|\s]+?\*\//.test(script)) throw new Error(global.i18n.t('user_api_add_failed_tip'))
  return script
}

export const setUserApi = async(apiId: string) => {
  global.lx.qualityList = {}
  setUserApiStatus(false, 'initing')

  const target = state.list.find(api => api.id === apiId)
  if (!target) throw new Error('api not found')
  const script = await getUserApiScript(target.id)
  loadScript({ ...target, script })
}

export const destroyUserApi = () => {
  destroy()
}


export const setUserApiStatus: typeof action['setStatus'] = (status, message) => {
  action.setStatus(status, message)
}

export const setUserApiList: typeof action['setUserApiList'] = (list) => {
  action.setUserApiList(list)
}

export const importUserApi = async(script: string) => {
  const info = await addUserApi(script)
  action.addUserApi(info)
}

/**
 * 用新脚本原地替换某个源（自动更新用）。
 *
 * 当前正在使用的源必须重新 `setUserApi`，否则界面里还是旧脚本注册的音质/动作
 * （`global.lx.apis` 不会自己刷新）——这件事由调用方 `core/init/userApi` 负责。
 */
export const updateUserApi = async(id: string, script: string) => {
  const info = await updateUserApiScript(id, script)
  action.setUserApiList(state.list.map(api => api.id === id ? info : api))
  return info
}

/**
 * 应用一次更新：按脚本上报的地址拉取新脚本并替换。
 *
 * 「有没有新版本」由脚本自己判断（脚本在 init 时 `send('updateAlert', {log, updateUrl})`），
 * 这里只负责用户点「更新」之后的下载与替换。
 */
export const applyUserApiUpdate = async(id: string, url: string): Promise<LX.UserApi.UserApiInfo> => {
  return updateUserApi(id, await fetchUserApiScript(url))
}

export const removeUserApi = async(ids: string[]) => {
  const list = await removeUserApiFromStore(ids)
  action.setUserApiList(list)
}

export const setUserApiAllowShowUpdateAlert = async(id: string, enable: boolean) => {
  await setUserApiAllowShowUpdateAlertFromStore(id, enable)
  action.setUserApiAllowShowUpdateAlert(id, enable)
}

export const log = {
  r_info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.info(...params)
  },
  r_warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.warn(...params)
  },
  r_error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.error(...params)
  },
  log(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.warn(...params)
  },
  error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.error(...params)
  },
}
