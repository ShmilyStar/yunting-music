import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'
import Image from '@/components/common/Image'
import IconMC from '@/components/common/IconMC'
import { REF_COLOR } from '@/config/uiPalette'
import { scaleSizeW } from '@/utils/pixelRatio'
import { getPicPath } from '@/core/music'

export interface SongThumbProps {
  /** 设计值边长 */
  size?: number
  /** 封面地址，取不到时画占位图标 */
  pic?: string | null
  /**
   * 拿不到 `pic` 时用它按需取一次封面。
   *
   * 搜索/榜单/播放队列里的歌曲，`meta.picUrl` 往往要等这首歌被播放或详情被拉取
   * 才会填上，所以列表行不能只看 `pic`——否则只有播放过的歌才有缩略图。
   */
  musicInfo?: LX.Music.MusicInfo | null
  /** 取封面时的列表 id（下载列表等按列表缓存封面时用） */
  listId?: string | null
  rounded?: number
  /** 没有封面时占位图标的名称（歌单 / 歌手 / 专辑聚合行各有各的语义图标） */
  placeholderIcon?: string
}

/**
 * 统一的歌曲缩略图：有封面用封面，没有则按需取一次，仍取不到才画占位图标。
 * 列表行、聚合行、播放列表弹层共用。
 */
export const SongThumb = memo(({ size = 42, pic, musicInfo, listId, rounded = 6, placeholderIcon = 'music-note' }: SongThumbProps) => {
  const px = scaleSizeW(size)
  const [fetched, setFetched] = useState<string | null>(null)
  const url = pic ?? fetched

  useEffect(() => {
    // 换歌时先清掉上一首取回的封面：否则这一帧仍画旧图，
    // 新请求失败或被取消时会一直停在旧封面上
    setFetched(null)
    if (pic) return
    if (!musicInfo) return
    let cancelled = false
    // `getPicPath` 已按来源分派：本地歌曲读内嵌封面（可能再按歌名找在线封面），
    // 在线歌曲走缓存；这里不再自己分支，否则本地路径会漏掉 `file://` 前缀
    void getPicPath({ musicInfo, listId }).then((path) => {
      if (!cancelled && path) setFetched(path)
    }).catch(() => {
      // 取不到就保持占位图标，不打扰用户
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pic, musicInfo?.id, listId])

  return (
    <View style={{
      width: px,
      height: px,
      borderRadius: rounded,
      overflow: 'hidden',
      backgroundColor: REF_COLOR.cardBg,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {url
        ? <Image url={url} style={{ width: px, height: px }} />
        : <IconMC name={placeholderIcon} size={Math.round(size * 0.5)} color={REF_COLOR.textHint} />}
    </View>
  )
})

export default SongThumb
