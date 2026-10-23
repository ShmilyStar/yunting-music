/**
 * FLAC 内嵌标签读取（Vorbis Comment + 封面 PICTURE 块）。
 *
 * **为什么需要自己解析**：iOS 上没有可用的 FLAC 标签库 ——
 * `react-native-local-media-metadata` 只有 Android 实现（走 jaudiotagger），
 * 而 AVFoundation 虽然能**播放** FLAC，却**不解析**它的 Vorbis Comment，
 * `AVMetadataItem` 里几乎没有 title / artist，`commonKeyArtwork` 也拿不到封面。
 * 于是 iOS「本地歌曲」里 flac 显示的是文件名、没有缩略图（用户 2026-10-22 反馈）。
 *
 * FLAC 的文件头非常适合「读前几百 KB 就够」：
 *
 * ```
 * "fLaC"
 * ├─ METADATA_BLOCK_HEADER (1B: last<<7 | type) + 3B 长度
 * │   ├─ 0  STREAMINFO     采样率 / 总采样数 → 时长
 * │   ├─ 4  VORBIS_COMMENT TITLE / ARTIST / ALBUM …（小端）
 * │   └─ 6  PICTURE        封面（大端，含 MIME 与图片字节）
 * └─ 音频帧…
 * ```
 *
 * 解析与 IO 分开：`parseFlacTags` 是纯函数（单测直接喂构造好的 Buffer），
 * `readFlacTags` 负责按需扩大读取窗口。
 */

import RNFS from 'react-native-fs'
import { stat, writeFile } from '@/utils/fs'

/** 封面数据（已转成 base64，落盘时直接用） */
export interface FlacPicture {
  /** base64 编码的图片字节 */
  base64: string
  /** 落盘扩展名：jpg / png / bmp */
  ext: string
}

export interface FlacTags {
  title: string
  artist: string
  album: string
  /** 时长（秒），由 STREAMINFO 的「总采样数 / 采样率」得出 */
  durationSec: number
  picture: FlacPicture | null
  /**
   * 是否因为「读到的窗口不够」而提前结束。
   * `readFlacTags` 据此决定要不要扩大窗口重读（封面常在文件靠后处）。
   */
  truncated: boolean
}

const FLAC_MAGIC = 'fLaC'
const BLOCK_STREAMINFO = 0
const BLOCK_VORBIS_COMMENT = 4
const BLOCK_PICTURE = 6
/** 单次最多读这么多字节：再大的封面也放弃，别把内存吃穿 */
const MAX_WINDOW = 8 * 1024 * 1024
/** 最多解析多少个元数据块（防坏文件死循环） */
const MAX_BLOCKS = 64
/** 封面图的常见类型码里，3 = 正面封面 */
const PICTURE_TYPE_FRONT_COVER = 3

const extFromMime = (mime: string, buf: Buffer, dataStart: number): string => {
  const lower = mime.toLowerCase()
  if (lower.includes('png')) return 'png'
  if (lower.includes('bmp')) return 'bmp'
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg'
  // MIME 缺失 / 不规范时按魔数兜底
  if (dataStart + 8 <= buf.length) {
    if (buf[dataStart] === 0x89 && buf[dataStart + 1] === 0x50) return 'png'
    if (buf[dataStart] === 0x42 && buf[dataStart + 1] === 0x4d) return 'bmp'
  }
  return 'jpg'
}

/**
 * 纯解析：喂多少字节就尽量解析多少。
 *
 * 任何越界 / 编码问题都不抛，返回已经拿到的部分（`truncated` 标记窗口不足）。
 */
export const parseFlacTags = (buf: Buffer): FlacTags | null => {
  const tags: FlacTags = {
    title: '',
    artist: '',
    album: '',
    durationSec: 0,
    picture: null,
    truncated: false,
  }
  if (buf.length < 8) return null

  let start = 0
  // 少数文件在 fLaC 前面塞了一个 ID3v2 标签（老工具转出来的），跳过它
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    start = 10 + size
  }
  if (start + 4 > buf.length || buf.toString('ascii', start, start + 4) !== FLAC_MAGIC) return null

  let offset = start + 4
  const artists: string[] = []

  for (let i = 0; i < MAX_BLOCKS; i++) {
    if (offset + 4 > buf.length) {
      tags.truncated = true
      break
    }
    const header = buf[offset]
    const isLast = (header & 0x80) !== 0
    const type = header & 0x7f
    const length = (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]
    const bodyStart = offset + 4
    const bodyEnd = bodyStart + length
    if (bodyEnd > buf.length) {
      // 这块没读全：已经拿到的字段保留，交给调用方决定要不要重读
      tags.truncated = true
      break
    }

    if (type === BLOCK_STREAMINFO && length >= 18) {
      // 采样率 20 位 / 声道 3 位 / 位深 5 位 / 总采样数 36 位，紧跟在 10 字节之后
      const sampleRate = (buf[bodyStart + 10] << 12) | (buf[bodyStart + 11] << 4) | (buf[bodyStart + 12] >> 4)
      const totalSamples =
        (buf[bodyStart + 13] & 0x0f) * 0x100000000 +
        ((buf[bodyStart + 14] << 24) >>> 0) +
        (buf[bodyStart + 15] << 16) +
        (buf[bodyStart + 16] << 8) +
        buf[bodyStart + 17]
      if (sampleRate > 0 && totalSamples > 0) tags.durationSec = totalSamples / sampleRate
    } else if (type === BLOCK_VORBIS_COMMENT && length > 8) {
      parseVorbisComment(buf, bodyStart, bodyEnd, tags, artists)
    } else if (type === BLOCK_PICTURE && length > 32) {
      const picture = parsePicture(buf, bodyStart, bodyEnd)
      // 多张图时优先留正面封面
      if (picture && (!tags.picture || picture.isFront)) tags.picture = picture.data
    }

    if (isLast) break
    offset = bodyEnd
  }

  if (artists.length) tags.artist = artists.join('/')
  return tags
}

const parseVorbisComment = (buf: Buffer, bodyStart: number, bodyEnd: number, tags: FlacTags, artists: string[]) => {
  let p = bodyStart
  if (p + 4 > bodyEnd) return
  const vendorLength = buf.readUInt32LE(p)
  p += 4 + vendorLength
  if (p + 4 > bodyEnd) return
  const count = buf.readUInt32LE(p)
  p += 4

  for (let i = 0; i < count; i++) {
    if (p + 4 > bodyEnd) return
    const length = buf.readUInt32LE(p)
    p += 4
    if (length <= 0 || p + length > bodyEnd) return
    const text = buf.toString('utf8', p, p + length)
    p += length
    const eq = text.indexOf('=')
    if (eq <= 0) continue
    const key = text.slice(0, eq).toUpperCase()
    const value = text.slice(eq + 1).trim()
    if (!value) continue
    if (key === 'TITLE') {
      if (!tags.title) tags.title = value
    } else if (key === 'ARTIST' || key === 'PERFORMER') {
      // 一首歌可能有多个 ARTIST，界面统一用 `/` 连起来
      if (!artists.includes(value)) artists.push(value)
    } else if (key === 'ALBUM') {
      if (!tags.album) tags.album = value
    }
  }
}

const parsePicture = (buf: Buffer, bodyStart: number, bodyEnd: number): { data: FlacPicture, isFront: boolean } | null => {
  let p = bodyStart
  if (p + 8 > bodyEnd) return null
  const pictureType = buf.readUInt32BE(p)
  p += 4
  const mimeLength = buf.readUInt32BE(p)
  p += 4
  if (p + mimeLength + 4 > bodyEnd) return null
  const mime = buf.toString('ascii', p, p + mimeLength)
  p += mimeLength
  const descLength = buf.readUInt32BE(p)
  p += 4 + descLength
  // 宽 / 高 / 色深 / 索引色数，各 4 字节，界面用不到
  p += 16
  if (p + 4 > bodyEnd) return null
  const dataLength = buf.readUInt32BE(p)
  p += 4
  if (dataLength <= 0 || p + dataLength > bodyEnd) return null
  return {
    data: {
      base64: buf.toString('base64', p, p + dataLength),
      ext: extFromMime(mime, buf, p),
    },
    isFront: pictureType === PICTURE_TYPE_FRONT_COVER,
  }
}

const readBuffer = async(filePath: string, length: number): Promise<Buffer> => {
  const base64 = await RNFS.read(filePath, length, 0, 'base64')
  return Buffer.from(base64, 'base64')
}

/**
 * 读 FLAC 标签：先读 128KB（绝大多数文件到这就够），
 * 若还有元数据块没读完（通常是封面）再翻倍重读，最多到 8MB。
 */
export const readFlacTags = async(filePath: string): Promise<FlacTags | null> => {
  let fileSize = 0
  try {
    fileSize = (await stat(filePath)).size ?? 0
  } catch {
    return null
  }
  if (!fileSize) return null

  let window = Math.min(fileSize, 128 * 1024)
  let tags = parseFlacTags(await readBuffer(filePath, window))
  if (!tags) return null

  while (tags.truncated && window < MAX_WINDOW && window < fileSize) {
    const next = Math.min(fileSize, MAX_WINDOW, window * 4)
    if (next <= window) break
    window = next
    const again = parseFlacTags(await readBuffer(filePath, window))
    if (!again) break
    tags = again
  }
  return tags
}

/** 把封面写到 `picBasePath` + 扩展名，返回最终路径（没有封面或写失败返回空串） */
export const writeFlacPicture = async(picture: FlacPicture | null, picBasePath: string): Promise<string> => {
  if (!picture || !picBasePath) return ''
  const target = `${picBasePath}.${picture.ext}`
  try {
    await writeFile(target, picture.base64, 'base64')
    return target
  } catch {
    return ''
  }
}
