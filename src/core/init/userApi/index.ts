import { getLoadScriptInfo, type InitParams, onScriptAction, sendAction, type ResponseParams, type UpdateInfoParams, type RequestParams } from '@/utils/nativeModules/userApi'
import { applyUserApiUpdate, log, setUserApi, setUserApiList, setUserApiStatus } from '@/core/userApi'
import settingState from '@/store/setting/state'
import BackgroundTimer from 'react-native-background-timer'
import { fetchData } from './request'
import { getUserApiList } from '@/utils/data'
import { confirmDialog, tipDialog, toast } from '@/utils/tools'


export default async(setting: LX.AppSetting) => {
  const userApiRequestMap = new Map<string, { resolve: (value: ResponseParams['result']) => void, reject: (error: Error) => void, timeout: number }>()
  const scriptRequestMap = new Map<string, { request: Promise<any>, abort: () => void }>()

  const cancelRequest = (requestKey: string, message: string) => {
    const target = scriptRequestMap.get(requestKey)
    if (!target) return
    scriptRequestMap.delete(requestKey)
    target.abort()
  }
  const sendScriptRequest = (requestKey: string, url: string, options: RequestParams['options']) => {
    let req = fetchData(url, options)
    req.request.then(response => {
      // console.log(response)
      sendAction('response', {
        error: null,
        requestKey,
        response,
      })
    }).catch(err => {
      sendAction('response', {
        error: err.message,
        requestKey,
        response: null,
      })
    }).finally(() => {
      scriptRequestMap.delete(requestKey)
    })
    scriptRequestMap.set(requestKey, req)
  }
  const sendUserApiRequest = async(data: LX.UserApi.UserApiRequestParams) => {
    const handleApiUpdate = () => {
      const target = userApiRequestMap.get(data.requestKey)
      if (!target) return
      userApiRequestMap.delete(data.requestKey)
      BackgroundTimer.clearTimeout(target.timeout)
      target.reject(new Error('request failed'))
    }
    const requestPromise = new Promise<ResponseParams['result']>((resolve, reject) => {
      userApiRequestMap.set(data.requestKey, {
        resolve,
        reject,
        timeout: BackgroundTimer.setTimeout(() => {
          const target = userApiRequestMap.get(data.requestKey)
          if (!target) return
          userApiRequestMap.delete(data.requestKey)
          // 超时此前静默只走 reject，真机错误日志无取证面（任务 9.8）：
          // 自定义源取链失败时这里是最上游归因点，带 action/source 落盘
          log.r_error(`[userApi] request timeout 20s action=${String(data.data?.action ?? '?')} source=${String(data.data?.source ?? '?')}`)
          target.reject(new Error('request timeout'))
        }, 20_000),
      })
      sendAction('request', data)
    }).finally(() => {
      global.state_event.off('apiSourceUpdated', handleApiUpdate)
    })
    global.state_event.on('apiSourceUpdated', handleApiUpdate)
    return requestPromise
  }
  const handleUserApiResponse = ({ status, result, requestKey, errorMessage }: ResponseParams) => {
    const target = userApiRequestMap.get(requestKey)
    if (!target) return
    userApiRequestMap.delete(requestKey)
    BackgroundTimer.clearTimeout(target.timeout)
    if (status) target.resolve(result)
    else {
      // 脚本侧失败此前只抛无上下文错误（任务 9.8）：带上脚本报回的
      // 原文落错误日志，区分「脚本抛错」与「链路超时」两类失败
      log.r_error(`[userApi] request failed: ${errorMessage ?? 'failed'}`)
      target.reject(new Error(errorMessage ?? 'failed'))
    }
  }
  const handleStateChange = ({ status, errorMessage, info }: InitParams) => {
    // console.log(status, message, info)
    setUserApiStatus(status, errorMessage)
    if (!info || info.id !== settingState.setting['common.apiSource']) return
    if (status) {
      if (info.sources) {
        let apis: any = {}
        let qualitys: LX.QualityList = {}
        for (const [source, { actions, type, qualitys: sourceQualitys }] of Object.entries(info.sources)) {
          if (type != 'music') continue
          apis[source as LX.Source] = {}
          for (const action of actions) {
            switch (action) {
              case 'musicUrl':
                apis[source].getMusicUrl = (songInfo: LX.Music.MusicInfo, type: LX.Quality) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'musicUrl',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return { type, url: res.data.url }
                    }).catch(err => {
                      console.log(err.message)
                      throw err
                    }),
                  }
                }
                break
              case 'lyric':
                apis[source].getLyric = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'lyric',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return res.data
                    }).catch(async err => {
                      console.log(err.message)
                      return Promise.reject(err)
                    }),
                  }
                }
                break
              case 'pic':
                apis[source].getPic = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'pic',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return res.data
                    }).catch(async err => {
                      console.log(err.message)
                      return Promise.reject(err)
                    }),
                  }
                }
                break
              default:
                break
            }
          }
          qualitys[source as LX.Source] = sourceQualitys
        }
        global.lx.qualityList = qualitys
        global.lx.apis = apis
        global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
      }
    } else {
      if (errorMessage) {
        void tipDialog({
          message: `${global.i18n.t('user_api__init_failed_alert', { name: info.name })}\n${errorMessage}`,
          // selection: true,
          btnText: global.i18n.t('ok'),
        })
      }
    }
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](status)
  }
  /**
   * 脚本在 init 时上报「有新版本」（`send('updateAlert', {log, updateUrl})`），走到这里：
   * 1. 弹窗只问一句「发现新版本，是否更新？」（用户点了才动，绝不静默覆盖脚本）；
   * 2. 确认后按**脚本上报的地址**拉新脚本、原 id 原地替换，正在用的源立刻热重载；
   * 3. 脚本没给可用地址时退回老行为（打开更新地址）。
   *
   * 为什么只用脚本上报的地址：导入时填的链接只是一次性下载地址，未必能再取到
   * 新版本；而脚本自己最清楚去哪里拿新版（用户 2026-10-22 要求）。
   *
   * 弹窗**只显示标题那一行**：脚本的更新说明（`updateMsg`）常混着更新地址甚至
   * Key 明文，铺在弹窗里又长又难看，按要求去掉；说明与版本仍写进错误日志便于排查。
   */
  const handleUpdateFound = async(
    target: { id: string, name: string, version: string },
    changeLog: string,
    downloadUrl: string | undefined,
  ) => {
    const message = global.i18n.t('user_api_update_alert', { name: target.name })
    if (changeLog) log.r_info(`[userApi] update available: ${target.name} ${target.version || '?'} ${changeLog}`)
    if (!downloadUrl) {
      void tipDialog({ message, btnText: global.i18n.t('ok') })
      return
    }
    const confirm = await confirmDialog({
      message,
      confirmButtonText: global.i18n.t('user_api_update_do_update'),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
    })
    if (!confirm) return
    try {
      const info = await applyUserApiUpdate(target.id, downloadUrl)
      // 正在用的源必须重载，否则取链还是旧脚本注册的实现
      if (settingState.setting['common.apiSource'] == info.id) void setUserApi(info.id)
      toast(global.i18n.t('user_api_update_success_tip', { name: info.name, version: info.version }))
    } catch (err: any) {
      log.r_error(`[userApi] update failed (${target.name}): ${err?.message ?? err}`)
      toast(global.i18n.t('user_api_update_failed_tip', { message: err?.message ?? String(err) }), 'long')
    }
  }

  const showUpdateAlert = ({ name, log: changeLog, updateUrl }: UpdateInfoParams) => {
    // 用当前加载的脚本身份定位列表里的源（id 是唯一可靠的锚点）
    const current = getLoadScriptInfo()
    if (!current) return
    void handleUpdateFound(
      { id: current.id, name: current.name || name, version: current.version },
      changeLog,
      updateUrl,
    )
  }

  onScriptAction((event) => {
    // console.log('script actuon: ', event)
    switch (event.action) {
      case 'init':
        if ((event as unknown as { errorMessage?: string }).errorMessage) event.data.errorMessage = (event as unknown as { errorMessage: string }).errorMessage
        handleStateChange(event.data)
        break
      case 'response':
        handleUserApiResponse(event.data)
        break
      case 'request':
        sendScriptRequest(event.data.requestKey, event.data.url, event.data.options)
        break
      case 'cancelRequest':
        cancelRequest(event.data, 'request canceled')
        break
      case 'showUpdateAlert':
        showUpdateAlert(event.data)
        break
      case 'log':
        switch ((event as unknown as { type: keyof typeof log }).type) {
          case 'log':
          case 'info':
            log.info((event as unknown as { log: string }).log)
            break
          case 'error':
            log.error((event as unknown as { log: string }).log)
            break
          case 'warn':
            log.warn((event as unknown as { log: string }).log)
            break
          default:
            break
        }
        break
      default:
        break
    }
  })

  setUserApiList(await getUserApiList())
}
