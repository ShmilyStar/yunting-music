import { memo, useCallback, useMemo, useState } from 'react'
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { navigations } from '@/navigation'

/** 大封面最多占可用宽度（02 §6.1） */
const PIC_WIDTH_RATIO = 0.92
/** 大封面最多占封面区高度 */
const PIC_HEIGHT_RATIO = 0.98

/**
 * 第 1 屏：大封面 + 歌词预览 + 歌名块。
 *
 * 封面区用 `flexGrow` 吃掉「歌名块以上」的全部剩余高度，封面在区内居中；
 * 这样 16:9 / 18:9 / 20:9 的手机都不会在歌名块下面留一大块空白，
 * 也不会把封面压到行动条上（20:9 上封面会按宽度上限放大）。
 */
export default memo(({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const { line } = useLrcPlay()
  const lines = useLrcSet()
  const [area, setArea] = useState({ width: 0, height: 0 })

  const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    setArea(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  const picSize = useMemo(() => {
    // 首帧还没有 onLayout：先按窗口宽度的 74% 估一个，避免闪一下 0 尺寸
    const areaWidth = area.width || winWidth * 0.74
    const areaHeight = area.height || winHeight * 0.42
    return Math.max(0, Math.floor(Math.min(
      areaWidth * PIC_WIDTH_RATIO,
      areaHeight * PIC_HEIGHT_RATIO,
    )))
  }, [area, winWidth, winHeight])

  // 歌词预览：当前行 + 下一行
  const currentText = line > -1 ? (lines[line]?.text ?? '') : ''
  const nextText = lines[line + 1]?.text ?? ''

  return (
    <View style={styles.container}>
      <View style={styles.picWrap} onLayout={handleLayout}>
        {picSize > 0
          ? <Image
              url={musicInfo.pic}
              nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
              style={{ width: picSize, height: picSize, borderRadius: 6 }}
            />
          : null}
      </View>
      <View style={styles.lyric}>
        {/* 当前唱到的那句染主题色，随播放进度逐句变化；下一句仍用灰字。
            字号按用户反馈调大（16/13 → 19/15），只影响歌词预览这两行 */}
        <Text size={19} numberOfLines={1} color={theme['c-primary']} style={styles.lyricText}>{currentText}</Text>
        <Text size={15} numberOfLines={1} color={theme['c-font-label']} style={styles.lyricText}>{nextText}</Text>
      </View>
      {/* 评论入口：规格 01 §2.5 把评论从独立按钮移进歌曲详情屏，
          这里挂在歌曲信息块上（截图 09 里该处没有额外可见控件） */}
      <TouchableOpacity
        style={styles.info}
        activeOpacity={0.7}
        onPress={() => { navigations.pushCommentScreen(componentId) }}
      >
        <Text size={19} numberOfLines={1}>{musicInfo.name}</Text>
        <Text size={12} numberOfLines={1} color={theme['c-font-label']} style={styles.singer}>
          {musicInfo.singer || t('play_detail_unknown_singer')}
        </Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 16,
  },
  picWrap: {
    flexGrow: 1,
    flexShrink: 1,
    // 显式 flexBasis:0：封面区只吃「歌名块以上」的剩余高度，不按内容撑开
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  lyric: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  lyricText: {
    textAlign: 'center',
  },
  info: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  singer: {
    marginTop: 4,
  },
})
