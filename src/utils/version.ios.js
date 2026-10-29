// iOS 的更新实现（Metro 在 iOS 平台会优先解析本文件，而不是 version.js）。
//
// 用户 2026-10-25 的最终要求：
//   - 启动时自动检查一次；用户点「检查更新」也检查一次，其它任何时机都不检查；
//   - 发现新版本弹窗「发现新版本 xxx」，点「否」退出 App，点「是」跳浏览器下载 IPA；
//   - 版本信息读 Gitee（失败回退 GitHub），安装包优先取 Gitee 发行版。
//
// 与 version.js 的差异只有「下载」这一步：iOS 无法安装 APK/沙盒内的包，
// 所以这里是**打开浏览器下载 IPA**，而不是下载后调系统安装器。
//
// 注意：本文件必须与 version.js 的请求层保持同步（同样的空值与超时保护），
// 否则 iOS 会重新出现「永远停在检查更新中」的问题。
import { Linking, Platform } from 'react-native'
import { httpGet } from '@/utils/request'

const REPO_OWNER = 'ShmilyStar'
const REPO_NAME = 'yunting-music'

const GITEE_RAW_BASE = `https://gitee.com/${REPO_OWNER}/${REPO_NAME}/raw/main`
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`

/**
 * 版本信息源：Gitee 优先，GitHub 兜底。
 *
 * Gitee 仓库只保留 publish/version.json（代码已清除），安装包在 Gitee 发行版；
 * GitHub 同内容同步保留，任一可用即可完成检查。
 */
const address = [
  [`${GITEE_RAW_BASE}/publish/version.json`, 'gitee'],
  [`${GITHUB_RAW_BASE}/publish/version.json`, 'github'],
]

/** 单次请求的硬超时：超时后必须 reject，不能让调用方永远 await 下去 */
const REQUEST_HARD_TIMEOUT = 12000
const MAX_RETRY = 2

/**
 * 单次请求。
 *
 * 必须显式判空：`httpGet` 失败时回调里 `resp` 是 null，直接读
 * `resp.statusCode` 会在回调内抛 TypeError。该异常不在 Promise 链上，
 * 会让 Promise 既不 resolve 也不 reject，界面上就是永远「检查更新中」。
 */
const request = (url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }

    const timer = setTimeout(() => {
      finish(reject, new Error('request timeout'))
    }, REQUEST_HARD_TIMEOUT)

    try {
      httpGet(url, { timeout: REQUEST_HARD_TIMEOUT }, (err, resp, body) => {
        if (settled) return
        const failed = err != null || resp == null || resp.statusCode !== 200
        if (!failed) {
          finish(resolve, body)
          return
        }
        if (retryNum >= MAX_RETRY) {
          finish(reject, err ?? new Error(resp ? (resp.statusMessage || String(resp.statusCode)) : 'no response'))
          return
        }
        request(url, retryNum + 1).then(
          value => finish(resolve, value),
          error => finish(reject, error),
        )
      })
    } catch (error) {
      finish(reject, error)
    }
  })
}

const getDirectInfo = (url) => {
  return request(url).then(info => {
    if (info == null || info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async(index = 0) => {
  const [url] = address[index]
  // 带时间戳绕开 CDN 缓存，避免按旧版本号比对（与 version.js 保持一致）
  const promise = getDirectInfo(`${url}?t=${Date.now()}`)

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

/**
 * 用户点「是」后：用系统浏览器打开 IPA 下载地址。
 *
 * iOS 没有「下载完自动装」的通道，装包必须自行重签，所以交给 Safari 后
 * 用户可直接存到「文件」或交给签名工具处理。Gitee 上没有该附件时退回 GitHub。
 */
export const downloadNewVersion = async(version) => {
  const file = `${REPO_NAME}-v${version}-unsigned.ipa`
  const ipaUrl = `https://gitee.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${file}`
  const fallback = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${file}`
  try {
    await Linking.openURL(ipaUrl)
  } catch (e) {
    await Linking.openURL(fallback)
  }
}

/** iOS 的「安装」入口：兜底打开下载页（正常流程不会走到） */
export const updateApp = async() => {
  await Linking.openURL(`https://gitee.com/${REPO_OWNER}/${REPO_NAME}/releases`)
}

/** 供其他模块判断平台，避免各自重复写 Platform.OS 判断 */
export const isIosUpdateFlow = Platform.OS === 'ios'
