// 任务 7.3：iOS 无应用内更新（指南 2.5.2）。版本检查逻辑保留，
// 下载/安装改为跳转 GitHub Release 页面。
import { Linking } from 'react-native'
import { httpGet } from '@/utils/request'
import { author, name } from '../../package.json'

const address = [
  // fork 更新通道：单源指向本仓库（见 openspec/changes/fork-update-channel）
  [`https://raw.githubusercontent.com/${author.name}/${name}/main/publish/version.json`, 'direct'],
]


const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
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
 * iOS 没有应用内更新（App Store 指南 2.5.2）。
 *
 * 用户在更新弹窗里确认后，**用系统浏览器打开 GitHub Release 页**，
 * 由用户自行下载安装（用户 2026-10-21 指定）。
 * 这里同样不自动跳转：只有用户点确认才会走到这个函数。
 */
export const downloadNewVersion = async(version) => {
  await Linking.openURL(`https://github.com/${author.name}/${name}/releases/tag/v${version}`)
}

/** iOS 的「安装」入口：打开 Release 列表页（兜底，正常流程不会走到） */
export const updateApp = async() => {
  await Linking.openURL(`https://github.com/${author.name}/${name}/releases`)
}
