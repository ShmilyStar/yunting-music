import { Linking, Platform } from 'react-native'
import { httpGet } from '@/utils/request'
import { downloadFile, stopDownload, temporaryDirectoryPath } from '@/utils/fs'
import RNFS from 'react-native-fs'
import { getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { APP_PROVIDER_NAME } from '@/config/constant'

const abis = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'universal',
]

/**
 * 版本信息源：Gitee 优先，GitHub 兜底。
 *
 * 用户 2026-10-25 的最终方案：
 *   - Gitee 仓库**只保留 publish/version.json**（代码全部清除），
 *     安装包放在 Gitee 的发行版（Releases）里；
 *   - 由私密仓库 ShmilyStar/MySync 的 Actions 负责把 GitHub 发布同步过去，
 *     并删除 Gitee 上的旧版本发行版，只留最新一个。
 *
 * 因此 App 侧检测读 Gitee 上那个唯一的 version.json，下载走 Gitee 发行版；
 * 只有 Gitee 不可用（网络 / 仓库被改私有 / 文件缺失）时才回退到 GitHub，
 * 避免国内用户上线就先白等一次超时。
 */
const REPO_OWNER = 'ShmilyStar'
const REPO_NAME = 'yunting-music'
const GITEE_RAW_BASE = `https://gitee.com/${REPO_OWNER}/${REPO_NAME}/raw/main`
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`

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
 * 旧实现在回调里写的是 `err || resp.statusCode != 200 ? ... : ...`：
 * 请求失败时 `httpGet` 回调拿到 `resp === null`，求值 `resp.statusCode`
 * 会抛 TypeError。该异常发生在回调内、不在 Promise 执行链上，于是
 * Promise **既不 resolve 也不 reject**，调用方永远卡在 await，界面上
 * 就是一直显示「检查更新中」。这里：
 *   1. 先判 err / resp 是否存在，再读 statusCode；
 *   2. 用 setTimeout 兜一层硬超时；
 *   3. 每一层异常都保证 settle。
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
  const promise = getDirectInfo(url)

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

/**
 * 选下载哪个 ABI 的包。
 *
 * 不用固定优先级表硬选：那样在 x86 模拟器上会去要 arm64 的包，而 Release
 * 里没传这个 ABI 时就只剩 404（实测：模拟器 getSupportedAbis 首选 x86_64，
 * 但表里 arm64-v8a 排在前面）。改为按设备声明的顺序试。
 */
const getTargetAbi = async() => {
  const supported = await getSupportedAbis()
  for (const abi of supported) {
    if (abis.includes(abi)) return abi
  }
  return 'universal'
}

let downloadJobId = null
const noop = (total, download) => {}
let apkSavePath

/**
 * 下载新版本 APK，**下载完成后自动调起系统安装界面**（用户 2026-10-21 指定）。
 *
 * 完整流程：
 *   启动自动检查 / 点「检查更新」→ 发现有新版本 → 弹窗询问 →
 *   用户点「是」→ 后台自动下载 → 下载完成直接拉起系统安装器 →
 *   由用户手动点「安装」。
 *
 * 注意「自动调起安装器」和「自动安装」是两回事：安装器的最后一步
 * （是否安装 / 授权未知来源）始终由用户在系统界面里手动确认，App 无法代劳。
 */
/** GitHub Release 里同名资源的下载地址，作为 Gitee 失败时的兜底 */
const githubApkUrl = (version, abi) =>
  `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${REPO_NAME}-v${version}-${abi}.apk`

/** Gitee 发行版里同名资源的下载地址（用户 2026-10-25 指定改到 Gitee） */
const giteeApkUrl = (version, abi) =>
  `https://gitee.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${REPO_NAME}-v${version}-${abi}.apk`

/**
 * 下载新版本 APK，**下载完成后自动调起系统安装界面**（用户 2026-10-21 指定）。
 *
 * 完整流程：
 *   启动自动检查 / 点「检查更新」→ 发现有新版本 → 弹窗询问 →
 *   用户点「是」→ 后台自动下载 → 下载完成直接拉起系统安装器 →
 *   由用户手动点「安装」。
 *
 * 下载源：Gitee 发行版优先，GitHub Release 兜底。两个仓库由 Actions
 * 自动同步，同一版本两边都有同名的 APK 附件，任一可用即可完成更新。
 *
 * 注意「自动调起安装器」和「自动安装」是两回事：安装器的最后一步
 * （是否安装 / 授权未知来源）始终由用户在系统界面里手动确认，App 无法代劳。
 */
export const downloadNewVersion = async(version, onDownload = noop) => {
  /**
   * iOS：不在 App 内下载，直接调浏览器去下 IPA（用户 2026-10-25 指定）。
   *
   * 原因：iOS 没有「下载完自动装」的通道，装包必须走签名 + 系统授权，
   * App 内下完也只能躺在沙盒里。交给 Safari 后用户可直接存到「文件」
   * 或交给签名工具处理，比在 App 里下完后无处可去更符合预期。
   */
  if (Platform.OS === 'ios') {
    const file = `${REPO_NAME}-v${version}-unsigned.ipa`
    const ipaUrl = `https://gitee.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${file}`
    const fallback = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${file}`
    try {
      await Linking.openURL(ipaUrl)
    } catch (e) {
      // Gitee 没传 IPA 时退回 GitHub 的同名附件
      await Linking.openURL(fallback)
    }
    return
  }

  const savePath = temporaryDirectoryPath + '/lx-music-mobile.apk'

  if (downloadJobId) stopDownload(downloadJobId)

  // 上一次残留的半截文件会让「下载成功」的判定失真，先清掉
  try {
    if (await RNFS.exists(savePath)) await RNFS.unlink(savePath)
  } catch (e) { /* 清不掉也不影响后续覆盖写 */ }

  const primaryAbi = await getTargetAbi()
  // 首选设备自己的 ABI；万一该发行版没传这个 ABI（404），
  // 再依次退到其它 ABI / universal，避免整条更新链直接失败
  const candidateAbis = [primaryAbi, ...abis.filter(a => a !== primaryAbi)]

  let lastErr = null
  for (const abi of candidateAbis) {
    // 同一 ABI 先试 Gitee，再试 GitHub
    for (const buildUrl of [giteeApkUrl, githubApkUrl]) {
      const url = buildUrl(version, abi)
      try {
        await downloadOne(url, savePath, onDownload)
        apkSavePath = savePath
        // 下载完直接拉起系统安装器，把「安装」这一步交给用户
        return updateApp()
      } catch (err) {
        lastErr = err
        console.log('[update] candidate failed:', abi, url, err && (err.message || err))
        try {
          if (await RNFS.exists(savePath)) await RNFS.unlink(savePath)
        } catch (e) { /* ignore */ }
      }
    }
  }
  throw lastErr ?? new Error('no download candidate')
}

/** 下载单个 ABI 的包；HTTP 非 200 或没落盘都视为失败 */
const downloadOne = (url, savePath, onDownload) => {
  const { jobId, promise } = downloadFile(url, savePath, {
    progressInterval: 500,
    connectionTimeout: 20000,
    readTimeout: 30000,
    begin({ statusCode, contentLength }) {
      onDownload(contentLength, 0)
    },
    progress({ contentLength, bytesWritten }) {
      onDownload(contentLength, bytesWritten)
    },
  })
  // 只清掉「自己」这个 job，避免用户连点两次时把后一个任务的 id 误清
  // eslint-disable-next-line require-atomic-updates -- 这个字段就是记录「当前下载任务」的，赋值对象是刚拿到的 jobId
  downloadJobId = jobId
  const currentJobId = jobId
  return promise.then(async(result) => {
    if (downloadJobId === currentJobId) downloadJobId = null
    /**
     * RNFS.downloadFile 在 HTTP 4xx/5xx 时**也会 resolve**，只是 statusCode
     * 不是 200 且落盘文件不存在。旧实现只看 promise 是否成功，于是 404
     * （Release 里没有对应 ABI 的资产）被当成下载成功，接着 installApk
     * 找不到文件。这里显式校验状态码、文件存在性与大小。
     */
    if (result && result.statusCode && result.statusCode !== 200) {
      throw new Error(`http ${result.statusCode}`)
    }
    if (!(await RNFS.exists(savePath))) throw new Error('apk not written')
    const stat = await RNFS.stat(savePath)
    if (!stat || !stat.size) throw new Error('apk is empty')
  })
}

/** 调起系统安装界面 */
export const updateApp = async() => {
  if (!apkSavePath) throw new Error('apk Save Path is null')
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
